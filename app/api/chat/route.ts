import { NextRequest, NextResponse } from "next/server";
import { DataAPIClient } from "@datastax/astra-db-ts";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { pipeline, env } from "@xenova/transformers";

env.allowRemoteModels = true;
env.allowLocalModels = false;

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  GEMINI_API_KEY,
} = process.env;

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN!);
const db = client.db(ASTRA_DB_API_ENDPOINT!, { keyspace: ASTRA_DB_NAMESPACE! });

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

type FeatureExtractionPipeline = (
  text: string,
  options: { pooling: "mean"; normalize: boolean }
) => Promise<{ data: Float32Array }>;

type SearchResult = {
  source?: string;
  content?: string;
};

const normalizeSearchResult = (result: unknown): SearchResult => {
  const record = result as Record<string, unknown>;

  return {
    source: typeof record.source === "string" ? record.source : undefined,
    content: typeof record.content === "string" ? record.content : undefined,
  };
};

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getStatusCode = (error: unknown): number | null => {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const statusValue = (error as { status?: unknown }).status;
  return typeof statusValue === "number" ? statusValue : null;
};

const isRetryableGeminiError = (error: unknown): boolean => {
  const status = getStatusCode(error);
  return status === 429 || status === 500 || status === 503;
};

const generateWithGemini = async (promptText: string): Promise<string> => {
  let lastError: unknown = null;

  for (const modelName of GEMINI_MODELS) {
    const model = genAI.getGenerativeModel({ model: modelName });

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`💬 Calling Gemini model ${modelName} (attempt ${attempt}/3)...`);
        const chatResponse = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          },
        });

        if (!chatResponse.response) {
          throw new Error("No response from Gemini");
        }

        return chatResponse.response.text() || "Unable to generate response";
      } catch (error) {
        lastError = error;

        if (!isRetryableGeminiError(error) || attempt === 3) {
          break;
        }

        const backoffMs = 700 * attempt;
        console.warn(
          `⚠️ Gemini temporary failure on ${modelName}, retrying in ${backoffMs}ms...`
        );
        await sleep(backoffMs);
      }
    }
  }

  throw lastError ?? new Error("Gemini generation failed");
};

let embeddingPipeline: FeatureExtractionPipeline | null = null;

const initEmbeddings = async () => {
  if (!embeddingPipeline) {
    embeddingPipeline = (await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    )) as FeatureExtractionPipeline;
  }
  return embeddingPipeline;
};

const generateEmbedding = async (text: string): Promise<number[]> => {
  const pipe = await initEmbeddings();
  const output = await pipe(text, {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(output.data);
};

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    console.log("📨 Received message:", message);

    // Step 1: Generate embedding for user message using Hugging Face
    try {
      console.log("🔍 Generating embedding with Hugging Face...");
      const vector = await generateEmbedding(message);
      console.log("✅ Embedding generated, dimension:", vector.length);

      // Step 2: Search for similar documents in vector database
      console.log("🔎 Searching vector database...");
      const collection = await db.collection(ASTRA_DB_COLLECTION!);

      const results = await collection
        .find(
          {},
          {
            sort: { $vector: vector },
            limit: 5,
          }
        )
        .toArray();

      console.log("📚 Found", results.length, "similar documents");

      // Step 3: Extract context from search results
      const context = results
        .map((result, index: number) => {
          const normalized = normalizeSearchResult(result);
          const source = normalized.source ?? "unknown source";
          const content = normalized.content ?? "";
          return `Source ${index + 1} (${source}): ${content}`;
        })
        .join("\n\n");

      // Step 4: Generate response using Gemini with context
      const systemPrompt = `You are a helpful knowledge assistant powered by RAG (Retrieval-Augmented Generation). 
You have access to information from Wikipedia about Artificial Intelligence, Internet of Things, Blockchain, and Computer Security.
Answer questions based on the provided context. If the context doesn't contain relevant information, say so politely.
Always cite your sources.`;

      const userPrompt = `Context from knowledge base:
${context}

User question: ${message}

Please provide a comprehensive answer based on the context above.`;

      const answer = await generateWithGemini(`${systemPrompt}\n\n${userPrompt}`);
      console.log("✅ Response generated successfully");

      return NextResponse.json({
        message,
        answer,
        sources: results
          .map((result) => normalizeSearchResult(result).source)
          .filter((source): source is string => Boolean(source)),
      });
    } catch (embeddingError: unknown) {
      console.error("❌ API Error:", embeddingError);
      throw embeddingError;
    }
  } catch (error: unknown) {
    console.error("❌ Chat API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to process message";
    return NextResponse.json(
      { error: `Failed to process message: ${errorMessage}` },
      { status: 500 }
    );
  }
}
