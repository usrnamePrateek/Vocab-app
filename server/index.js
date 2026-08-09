import cors from 'cors'
import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { WORD_BANK } from './wordBank.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, '..', 'data', 'words.json')
const PORT = 3001

const app = express()
app.use(cors())
app.use(express.json())

async function readStore() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { currentWord: null, saved: [] }
  }
}

async function writeStore(store) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8')
}

function todayKey() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function pickBestDefinition(entry) {
  const ranked = []
  for (const meaning of entry.meanings ?? []) {
    for (const def of meaning.definitions ?? []) {
      if (!def.definition) continue
      ranked.push({
        partOfSpeech: meaning.partOfSpeech ?? '',
        meaning: def.definition,
        example: def.example || '',
        score:
          (def.example ? 3 : 0) +
          (['adjective', 'verb', 'noun', 'adverb'].includes(meaning.partOfSpeech)
            ? 1
            : 0) +
          (def.definition.length < 160 ? 1 : 0),
      })
    }
  }
  ranked.sort((a, b) => b.score - a.score)
  return ranked[0] ?? null
}

async function fetchDefinition(word) {
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
  )
  if (!res.ok) return null

  const data = await res.json()
  const entry = data[0]
  if (!entry) return null

  const best = pickBestDefinition(entry)
  if (!best) return null

  const phonetic =
    entry.phonetic ||
    entry.phonetics?.find((p) => p.text)?.text ||
    ''

  return {
    word: entry.word,
    phonetic,
    partOfSpeech: best.partOfSpeech,
    meaning: best.meaning,
    example: best.example || buildFallbackExample(entry.word),
  }
}

function buildFallbackExample(word) {
  return `She used the word "${word}" carefully in her essay.`
}

async function pickNewWord(exclude = []) {
  const excluded = new Set(exclude.map((w) => w.toLowerCase()))
  const pool = WORD_BANK.filter((w) => !excluded.has(w.toLowerCase()))
  const candidates = pool.length > 0 ? pool : WORD_BANK

  for (let attempt = 0; attempt < 12; attempt++) {
    const word = candidates[Math.floor(Math.random() * candidates.length)]
    const definition = await fetchDefinition(word)
    if (definition) return definition
  }

  throw new Error('Could not fetch a word definition. Try again.')
}

app.get('/api/words', async (_req, res) => {
  try {
    const store = await readStore()
    res.json(store)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

let todayLock = Promise.resolve()

app.get('/api/word/today', async (req, res) => {
  const clientDate =
    typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : todayKey()

  const run = todayLock.then(async () => {
    const store = await readStore()

    if (store.currentWord?.date === clientDate) {
      return store.currentWord
    }

    const used = store.saved.map((s) => s.word)
    const word = await pickNewWord(used)
    store.currentWord = {
      ...word,
      id: crypto.randomUUID(),
      date: clientDate,
      fetchedAt: new Date().toISOString(),
    }
    await writeStore(store)
    return store.currentWord
  })

  todayLock = run.then(
    () => undefined,
    () => undefined,
  )

  try {
    const word = await run
    res.json(word)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/word/new', async (req, res) => {
  try {
    const clientDate =
      typeof req.body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date)
        ? req.body.date
        : todayKey()

    const store = await readStore()
    const used = [
      ...store.saved.map((s) => s.word),
      store.currentWord?.word,
    ].filter(Boolean)

    const word = await pickNewWord(used)
    store.currentWord = {
      ...word,
      id: crypto.randomUUID(),
      date: clientDate,
      fetchedAt: new Date().toISOString(),
    }
    await writeStore(store)
    res.json(store.currentWord)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/words', async (req, res) => {
  try {
    const { userSentence, word: clientWord } = req.body ?? {}
    if (!userSentence || typeof userSentence !== 'string' || !userSentence.trim()) {
      return res.status(400).json({ error: 'Please write a sentence using the word.' })
    }

    const store = await readStore()
    const source =
      store.currentWord &&
      (!clientWord?.id || store.currentWord.id === clientWord.id)
        ? store.currentWord
        : isValidWord(clientWord)
          ? clientWord
          : null

    if (!source) {
      return res.status(400).json({ error: 'No current word to save. Get a new word and try again.' })
    }

    const wordLower = source.word.toLowerCase()
    if (!userSentence.toLowerCase().includes(wordLower)) {
      return res.status(400).json({
        error: `Your sentence must include the word "${source.word}".`,
      })
    }

    const entry = {
      ...source,
      userSentence: userSentence.trim(),
      savedAt: new Date().toISOString(),
    }

    store.currentWord = {
      id: source.id,
      word: source.word,
      phonetic: source.phonetic ?? '',
      partOfSpeech: source.partOfSpeech ?? '',
      meaning: source.meaning,
      example: source.example,
      date: source.date,
      fetchedAt: source.fetchedAt,
    }
    store.saved = [entry, ...store.saved.filter((s) => s.id !== entry.id)]
    await writeStore(store)
    res.json({ saved: store.saved, currentWord: store.currentWord })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function isValidWord(word) {
  return (
    word &&
    typeof word === 'object' &&
    typeof word.id === 'string' &&
    typeof word.word === 'string' &&
    typeof word.meaning === 'string' &&
    typeof word.example === 'string' &&
    typeof word.date === 'string' &&
    typeof word.fetchedAt === 'string'
  )
}

app.delete('/api/words/:id', async (req, res) => {
  try {
    const store = await readStore()
    store.saved = store.saved.filter((s) => s.id !== req.params.id)
    await writeStore(store)
    res.json({ saved: store.saved })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`Vocab Master API on http://localhost:${PORT}`)
})
