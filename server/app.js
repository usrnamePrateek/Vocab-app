import cors from 'cors'
import express from 'express'
import { pickRandomWord } from './dictionary.js'
import { readStore, writeStore } from './store.js'

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
    { signal: AbortSignal.timeout(3000) }
  )
  if (!res.ok) {
    if (res.status >= 500) throw new Error(`API returned status ${res.status}`);
    return null;
  }

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
  let apiErrors = 0

  for (let attempt = 0; attempt < 10; attempt++) {
    const word = pickRandomWord([...excluded])
    try {
      const definition = await fetchDefinition(word)
      if (definition) return definition
      excluded.add(word.toLowerCase())
    } catch (err) {
      apiErrors++
      if (apiErrors >= 2) {
        console.error(`Dictionary API failed for "${word}":`, err.message)
        throw new Error('Dictionary API is currently unavailable or too slow. Please try again later.')
      }
    }
  }

  throw new Error('Could not fetch a valid word definition after 10 attempts. Try again.')
}

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

export function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json())

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
        return res
          .status(400)
          .json({ error: 'No current word to save. Get a new word and try again.' })
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

  return app
}
