import { DataAPIClient } from "@datastax/astra-db-ts";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  GEMINI_API_KEY,
} = process.env;

async function diagnose() {
  console.log("🔍 RAG Chatbot Diagnostic Tool\n");

  // Check environment variables
  console.log("1️⃣  Checking environment variables...");
  console.log(
    `   GEMINI_API_KEY: ${GEMINI_API_KEY ? "✅ Set" : "❌ Missing"}`
  );
  console.log(
    `   ASTRA_DB_APPLICATION_TOKEN: ${ASTRA_DB_APPLICATION_TOKEN ? "✅ Set" : "❌ Missing"}`
  );
  console.log(
    `   ASTRA_DB_API_ENDPOINT: ${ASTRA_DB_API_ENDPOINT ? "✅ Set" : "❌ Missing"}`
  );

  if (!GEMINI_API_KEY || !ASTRA_DB_APPLICATION_TOKEN) {
    console.error("\n❌ Missing required environment variables!");
    process.exit(1);
  }

  // Test Gemini API
  console.log("\n2️⃣  Testing Gemini API...");
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Try different model name formats
    const modelNames = [
      "models/embedding-001",
      "embedding-001", 
      "models/text-embedding-004",
      "text-embedding-004"
    ];
    
    let embedded = false;
    for (const modelName of modelNames) {
      try {
        console.log(`   Trying model: ${modelName}...`);
        const embeddingModel = genAI.getGenerativeModel({
          model: modelName,
        });
        const testResult = await embeddingModel.embedContent("test");
        
        if (testResult.embedding && testResult.embedding.values) {
          console.log(
            `   ✅ Working model found: ${modelName} (dimension: ${testResult.embedding.values.length})`
          );
          embedded = true;
          break;
        }
      } catch (e) {
        // Try next model
      }
    }
    
    if (!embedded) {
      console.error("   ❌ No working embedding model found");
    }
  } catch (error: any) {
    console.error("   ❌ Gemini API error:", error.message);
  }

  // Test Astra DB connection
  console.log("\n3️⃣  Testing Astra DB connection...");
  try {
    const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
    const db = client.db(ASTRA_DB_API_ENDPOINT!, {
      keyspace: ASTRA_DB_NAMESPACE,
    });
    const collection = await db.collection(ASTRA_DB_COLLECTION!);
    console.log("   ✅ Connected to Astra DB");

    // Check collection size
    const stats = await collection.countDocuments({}, 1000);
    console.log(`   📊 Collection has ${stats} documents`);

    if (stats === 0) {
      console.warn(
        "   ⚠️  Collection is empty! Run 'npm run seed' to load data."
      );
    } else {
      // Sample a document
      const sample = await collection.findOne({});
      if (sample) {
        console.log(
          `   📄 Sample document source: ${sample.source || "N/A"}`
        );
        if (sample.$vector) {
          console.log(`   📏 Vector dimension: ${sample.$vector.length}`);
        }
      }
    }
  } catch (error: any) {
    console.error("   ❌ Astra DB error:", error.message);
  }

  // Test complete RAG pipeline
  console.log("\n4️⃣  Testing RAG pipeline...");
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
    const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN!);
    const db = client.db(ASTRA_DB_API_ENDPOINT!, {
      keyspace: ASTRA_DB_NAMESPACE!,
    });
    const collection = await db.collection(ASTRA_DB_COLLECTION!);

    // Test query
    const testQuery = "What is artificial intelligence?";
    console.log(`   Testing query: "${testQuery}"`);

    // Generate embedding
    const embeddingModel = genAI.getGenerativeModel({
      model: "text-embedding-004",
    });
    const embeddingResult = await embeddingModel.embedContent(testQuery);
    const vector = embeddingResult.embedding.values;
    console.log(
      `   ✅ Generated query embedding (dimension: ${vector.length})`
    );

    // Search
    const results = await collection
      .find({ $vector: vector }, { sort: { $vector: vector }, limit: 5 })
      .toArray();

    console.log(`   ✅ Found ${results.length} similar documents`);

    if (results.length > 0) {
      console.log(`   📌 Top result: ${results[0].source}`);
    }
  } catch (error: any) {
    console.error("   ❌ RAG pipeline error:", error.message);
  }

  console.log("\n✨ Diagnostic complete!");
}

diagnose().catch(console.error);
