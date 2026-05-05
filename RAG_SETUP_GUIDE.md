# 🤖 RAG Chatbot System - Complete Setup Guide

Your RAG (Retrieval-Augmented Generation) chatbot is now fully built! Here's what you have:

## 📦 Architecture Overview

```
1. Data Loading (scripts/loadDb.ts)
   └─> Fetches Wikipedia articles
   └─> Chunks text into 512-char segments
   └─> Generates embeddings via OpenAI
   └─> Stores in Astra DB vector database

2. Chat API (app/api/chat/route.ts)
   └─> Accepts user questions
   └─> Generates query embedding
   └─> Searches vector database (top 5 results)
   └─> Uses results as context for OpenAI
   └─> Returns answer + sources

3. Chat UI (app/page.tsx)
   └─> Beautiful conversation interface
   └─> Real-time message streaming
   └─> Shows sources for transparency
   └─> Dark mode support
```

## 🚀 Getting Started

### 1. Set Your Environment Variables

Create/update your `.env.local` file:
```bash
ASTRA_DB_API_ENDPOINT=your_astra_endpoint
ASTRA_DB_APPLICATION_TOKEN=your_astra_token
ASTRA_DB_NAMESPACE=default_keyspace
ASTRA_DB_COLLECTION=rag_chunks
OPENAI_API_KEY=your_openai_key
```

### 2. Load Data into Vector Database

Run the data loading script:
```bash
npm run seed
```

This will:
- ✅ Create a vector collection in Astra DB
- ✅ Load 4 Wikipedia articles (AI, IoT, Blockchain, Cybersecurity)
- ✅ Generate embeddings for each chunk
- ✅ Store everything in the vector database

**Note:** This takes a few minutes due to:
- Web scraping with Puppeteer
- Text splitting (creates ~200-400 chunks per article)
- Embedding generation via OpenAI API

### 3. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start chatting!

## 🔍 How It Works (Deep Dive)

### Data Loading Pipeline
```
Wikipedia Article
    ↓
PuppeteerWebBaseLoader (scrapes content)
    ↓
RecursiveCharacterTextSplitter (512 chars, 100 overlap)
    ↓
OpenAI Embeddings (text-embedding-3-small)
    ↓
Astra DB Vector Storage (dot_product metric)
```

### Chat Flow
```
User Question
    ↓
Generate Embedding (same model as training)
    ↓
Vector Similarity Search (top 5 results)
    ↓
OpenAI with Context + System Prompt
    ↓
Response + Source Attribution
```

## 📊 Key Components

| Component | Purpose | Technology |
|-----------|---------|-----------|
| `loadDb.ts` | Data ingestion & embedding | LangChain, OpenAI, Astra DB |
| `api/chat/route.ts` | Query processing | Node.js, OpenAI |
| `page.tsx` | Chat interface | React, TypeScript, Tailwind |
| `layout.tsx` | App structure | Next.js |

## 🎯 Features

✨ **Smart Retrieval** - Finds relevant docs using vector similarity
✨ **Source Attribution** - Shows where answers come from  
✨ **Context Aware** - Uses top 5 documents for responses
✨ **Dark Mode** - Beautiful UI in light & dark themes
✨ **Streaming UX** - Real-time feedback while processing
✨ **Error Handling** - Graceful fallbacks

## 🔧 Customization

### Add More Data Sources
Edit `scripts/loadDb.ts`:
```typescript
const ragData = [
    'https://en.wikipedia.org/wiki/Your_Topic_1',
    'https://en.wikipedia.org/wiki/Your_Topic_2',
    // Add more URLs
]
```

### Adjust Chunk Size
Change in `scripts/loadDb.ts`:
```typescript
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1024,  // Increase for longer context
    chunkOverlap: 200 // More overlap = more redundancy
})
```

### Change Retrieval Results
Modify in `app/api/chat/route.ts`:
```typescript
limit: 10,  // Retrieve more documents
```

### Custom System Prompt
Edit in `app/api/chat/route.ts`:
```typescript
const systemPrompt = `Your custom instructions here...`
```

## 💡 Tips

1. **First Run Slow?** - Vector database is being populated. Subsequent queries are instant.
2. **API Costs** - Each query generates 2 embeddings (query + context search) + 1 completion
3. **Best Practices**:
   - Keep chunks 256-1024 characters for balance
   - Use high-quality, relevant documents
   - Test different similarity thresholds
   - Monitor token usage in OpenAI dashboard

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot find module" | Run `npm install --legacy-peer-deps` |
| Astra DB connection fails | Check credentials in `.env.local` |
| Slow responses | Data loading still in progress, wait 5 minutes |
| Poor answer quality | Add more relevant documents to knowledge base |

## 📚 Next Steps

1. Deploy to Vercel
2. Add more data sources
3. Fine-tune the system prompt
4. Implement conversation history
5. Add multi-language support
6. Implement authentication

## 🎉 You're All Set!

Your RAG chatbot is production-ready. Customize it, deploy it, and enjoy intelligent conversations powered by your own knowledge base!

---

**Questions?** Check the code comments or explore the LangChain & Astra DB documentation.
