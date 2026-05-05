**Project Overview**

- **Purpose**: A proof-of-concept RAG (Retrieval-Augmented Generation) chatbot built with Next.js + TypeScript. It indexes content using free Hugging Face embeddings and stores vectors in DataStax Astra DB, and uses Google Gemini for generation with retry/fallback logic.

**Architecture**

- **Frontend**: Next.js app providing a chat UI ([app/page.tsx](app/page.tsx)).
- **API**: Server route that embeds queries, performs vector search in Astra DB, then calls Gemini to generate answers ([app/api/chat/route.ts](app/api/chat/route.ts)).
- **Embedding & Seeding**: `scripts/loadDb.ts` fetches content (MediaWiki extracts), splits into chunks, computes embeddings with Xenova/all-MiniLM-L6-v2, and saves vectors to Astra DB.

**Quick Start (local)**

Prerequisites:

- **Node.js** (recommended >= 18)
- An Astra DB key and endpoint (see env variables below)
- A Gemini/Generative AI API key for responses (optional but recommended)

Install dependencies:

```bash
npm install
```

Create a `.env` file at the repository root with these values (see details below):

```
ASTRA_DB_API_ENDPOINT=...         # e.g. https://<db-id>-apps.astra.datastax.com
ASTRA_DB_APPLICATION_TOKEN=...    # Astra DB Application Token
ASTRA_DB_NAMESPACE=...            # e.g. user_keyspace
ASTRA_DB_COLLECTION=...           # collection name used by seeder
GEMINI_API_KEY=...                # Google Generative AI key used by server
# Optional fallback or legacy keys
# OPENAI_API_KEY=
```

Seed the vector store (downloads HF model the first run):

```bash
npm run seed
```

Start the dev server:

```bash
npm run dev
```

Open http://localhost:3000 and start chatting.

**Key Files**

- **Seeder**: [scripts/loadDb.ts](scripts/loadDb.ts) — fetches sources, chunks text, generates embeddings using `@xenova/transformers` (Xenova/all-MiniLM-L6-v2), and inserts vectors into Astra DB. Embedding dimension: 384.
- **API route**: [app/api/chat/route.ts](app/api/chat/route.ts) — embeds queries, runs vector search against Astra DB (uses empty filter + `sort: { $vector: vector }`), then formats context and calls Gemini. Includes retry/backoff and model fallback.
- **Frontend**: [app/page.tsx](app/page.tsx) and [app/globals.css](app/globals.css).

**Environment Variables (details)**

- **ASTRA_DB_API_ENDPOINT**: Astra DB REST/GraphQL endpoint host.
- **ASTRA_DB_APPLICATION_TOKEN**: Application token for the Astra DB namespace/collection.
- **ASTRA_DB_NAMESPACE**: Database namespace/keyspace used by the app and seeder.
- **ASTRA_DB_COLLECTION**: Collection name where vectors are stored. Must match the seeder.
- **GEMINI_API_KEY**: API key for Google Generative AI used by the server for generation. The server implements retry and a fallback model.

Note: The embedding dimension in Astra DB must match the embeddings produced by the model (currently 384). If you have an older collection created with a different dimension, recreate the collection or change `ASTRA_DB_COLLECTION` to a fresh name before seeding.

**Seeding notes & behaviour**

- The seeder uses the MediaWiki extracts API (no Puppeteer) to retrieve page text for source articles.
- Text is chunked using a RecursiveCharacterTextSplitter (chunkSize ~512, overlap ~100) before embedding.
- Embeddings are created with `@xenova/transformers` pipeline `feature-extraction` for `Xenova/all-MiniLM-L6-v2` and reduced to 384-d vectors via mean pooling and normalization.
- The first seeding run downloads the model weights (may take time). Subsequent runs reuse the cached model.

Run the seeder with:

```bash
npm run seed
```

Expected output: the script will create the collection (if necessary) and insert chunked documents. You can verify the document count via Astra DB console or with a small Node script.

**API & Query flow**

1. Frontend sends a query to `POST /api/chat`.
2. `route.ts` generates an embedding (same HF model) and queries Astra DB using vector sort.
3. Top results are assembled into a context prompt and sent to Gemini for answer generation.
4. Response and cited sources are returned to the frontend.

**Troubleshooting**

- **Gemini transient 503 (high demand)**: The API integration includes retry/backoff and a fallback model. If you repeatedly see 503 errors, wait and retry later or switch to the lighter fallback model in `app/api/chat/route.ts`.
- **Astra collection dimension mismatch**: If searches fail due to vector dimension mismatch, ensure the collection was created with `vector.dimension = 384` (see `scripts/loadDb.ts`). Best practice: use a fresh collection name and re-run `npm run seed`.
- **Long first-run seed**: Model download for `@xenova/transformers` may be large. Allow time for the download and sufficient disk space.
- **Puppeteer errors**: Older drafts used Puppeteer; the current seeder uses MediaWiki extracts and does not require Puppeteer.

**Development & Tests**

- Lint with:

```bash
npm run lint
```

- To inspect document count quickly (example Node one-liner):

```bash
node -e "(async()=>{const c=require('./scripts/diagnose').count;console.log(await c())})()"
```

**Where to look in the code**

- Seeder: [scripts/loadDb.ts](scripts/loadDb.ts)
- Server route: [app/api/chat/route.ts](app/api/chat/route.ts)
- UI: [app/page.tsx](app/page.tsx) and [app/globals.css](app/globals.css)
- Diagnostics / helpers: [scripts/diagnose.ts](scripts/diagnose.ts)

**Next steps / ideas**

- Add automated tests for the seeder and API flow.
- Add CI step to seed a small sample dataset for integration tests.
- Add a persistence layer for chat transcripts and user sessions.

If you want, I can also:

- run the seeder locally and confirm collection counts,
- add a short troubleshooting script that checks Astra connectivity and model availability,
- or prepare a small demo script that sends a sample query and prints the full API response.

----

Generated by an in-repo assistant. If anything in this README looks out-of-date with your local changes, tell me which file to inspect and I will update the docs accordingly.
