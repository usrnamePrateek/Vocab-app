# Vocab Master

A mobile-friendly React app that serves a daily vocabulary word (or a new one on demand), shows its meaning and an example sentence, and asks you to write your own sentence.

Words are stored in **MongoDB Atlas** (external database), so the app works on Vercel.

## Setup

### 1. MongoDB Atlas

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a database user (username + password)
3. Network Access → allow `0.0.0.0/0` (or your IPs)
4. Database → Connect → Drivers → copy the connection string

### 2. Environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set:

```bash
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

Optional: `MONGODB_DB=vocab_master` (default database name)

### 3. Run locally

```bash
npm install
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:3001

## Deploy to Vercel

1. Push the repo to GitHub
2. Import the project in Vercel
3. Add Environment Variable: `MONGODB_URI` (same value as `.env`)
4. Deploy

Framework preset: **Vite**  
Build command: `npm run build`  
Output directory: `dist`

API routes are handled by `api/index.js` (serverless). The dictionary file is bundled via `vercel.json`.

## How it works

- Words are picked randomly from `data/dictionary.txt`
- Definitions come from the [Free Dictionary API](https://dictionaryapi.dev/)
- Current word + saved sentences live in a single MongoDB document (`vocab_master.store`)
