import { DataAPIClient } from "@datastax/astra-db-ts";
import { RecursiveCharacterTextSplitter } from "@langchain/classic/text_splitter";
import { pipeline, env } from "@xenova/transformers";

import "dotenv/config";

env.allowRemoteModels = true;
env.allowLocalModels = false;

type similarityMetric = "dot_product" | "cosine" | "euclidean";

const {
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
} = process.env;

const ragData = [
    "https://en.wikipedia.org/wiki/Artificial_intelligence",
    "https://en.wikipedia.org/wiki/Internet_of_things",
    "https://en.wikipedia.org/wiki/Blockchain",
    "https://en.wikipedia.org/wiki/Computer_security",
];

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN!);
const db = client.db(ASTRA_DB_API_ENDPOINT!, { keyspace: ASTRA_DB_NAMESPACE! });

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100,
});

const getWikipediaPlainTextUrl = (url: string) => {
    const title = new URL(url).pathname.replace("/wiki/", "");
    return `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&origin=*&titles=${encodeURIComponent(title)}`;
};

type FeatureExtractionPipeline = (
    text: string,
    options: { pooling: "mean"; normalize: boolean }
) => Promise<{ data: Float32Array }>;

let embeddingPipeline: FeatureExtractionPipeline | null = null;

const initEmbeddings = async () => {
    if (!embeddingPipeline) {
        console.log("🔄 Initializing Hugging Face embeddings...");
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

const createCollection = async (
    similarityMetric: similarityMetric = "dot_product"
) => {
    try {
        const res = await db.createCollection(ASTRA_DB_COLLECTION!, {
            vector: {
                dimension: 384,
                metric: similarityMetric,
            },
        });
        console.log("Collection created successfully");
        return res;
    } catch (error: unknown) {
        if (error instanceof Error && error.message.includes("already exists")) {
            console.log("Collection already exists");
            return null;
        }
        throw error;
    }
};

const loadSampleData = async () => {
    const collection = await db.collection(ASTRA_DB_COLLECTION!);

    for (const url of ragData) {
        console.log(`\n📄 Loading ${url}...`);
        try {
            const plainTextUrl = getWikipediaPlainTextUrl(url);
            const response = await fetch(plainTextUrl, {
                headers: {
                    "user-agent": "ragchbot/1.0",
                    accept: "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(
                    `Failed to fetch article text: ${response.status} ${response.statusText}`
                );
            }

            const payload = (await response.json()) as {
                query?: {
                    pages?: Record<string, { extract?: string }>;
                };
            };

            const articleText =
                payload.query && payload.query.pages
                    ? Object.values(payload.query.pages)[0]?.extract ?? ""
                    : "";

            if (!articleText) {
                throw new Error("No article text returned from Wikipedia API");
            }
            console.log(`✓ Loaded article text (${articleText.length} chars)`);

            const chunks = await splitter.splitText(articleText);
            console.log(`✓ Split into ${chunks.length} chunks`);

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];

                try {
                    const vector = await generateEmbedding(chunk);

                    await collection.insertOne({
                        $vector: vector,
                        content: chunk,
                        source: url,
                        metadata: { article: url },
                    });

                    if ((i + 1) % 10 === 0) {
                        console.log(`  → Inserted ${i + 1}/${chunks.length} chunks`);
                    }
                } catch (chunkError) {
                    console.error(`  ❌ Error processing chunk ${i}:`, chunkError);
                    continue;
                }
            }

            console.log(`✅ Complete: ${chunks.length} chunks stored for ${url}`);
        } catch (error) {
            console.error(`❌ Error loading ${url}:`, error);
        }
    }
};

const main = async () => {
    console.log("🚀 Starting RAG data loading with Hugging Face embeddings...\n");

    try {
        await createCollection();
        await loadSampleData();
        console.log("\n✨ Data loading complete!");
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
};

main();