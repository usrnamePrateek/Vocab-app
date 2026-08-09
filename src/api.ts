import { localDateKey } from './dates'
import type { VocabWord, WordStore } from './types'

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong')
  }
  return data as T
}

export async function fetchStore(): Promise<WordStore> {
  const res = await fetch('/api/words')
  return parseJson(res)
}

export async function fetchTodayWord(): Promise<VocabWord> {
  const res = await fetch(`/api/word/today?date=${localDateKey()}`)
  return parseJson(res)
}

export async function fetchNewWord(): Promise<VocabWord> {
  const res = await fetch('/api/word/new', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: localDateKey() }),
  })
  return parseJson(res)
}

export async function saveSentence(
  userSentence: string,
  word: VocabWord,
): Promise<WordStore> {
  const res = await fetch('/api/words', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userSentence, word }),
  })
  return parseJson(res)
}

export async function deleteWord(id: string): Promise<{ saved: VocabWord[] }> {
  const res = await fetch(`/api/words/${id}`, { method: 'DELETE' })
  return parseJson(res)
}
