import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DICTIONARY_FILE = path.join(__dirname, '..', 'data', 'dictionary.txt')

let words = []

export async function loadDictionary() {
  const raw = await fs.readFile(DICTIONARY_FILE, 'utf-8')
  words = raw
    .split(/\r?\n/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 6 && w.length <= 12 && /^[a-z]+$/.test(w))

  if (words.length === 0) {
    throw new Error('Dictionary file is empty. Check data/dictionary.txt')
  }

  return words.length
}

export function getDictionarySize() {
  return words.length
}

export function pickRandomWord(exclude = []) {
  if (words.length === 0) {
    throw new Error('Dictionary not loaded yet')
  }

  const excluded = new Set(exclude.map((w) => w.toLowerCase()))
  const pool = words.filter((w) => !excluded.has(w))
  const candidates = pool.length > 0 ? pool : words
  return candidates[Math.floor(Math.random() * candidates.length)]
}
