export type VocabWord = {
  id: string
  word: string
  phonetic: string
  partOfSpeech: string
  meaning: string
  example: string
  date: string
  fetchedAt: string
  userSentence?: string
  savedAt?: string
}

export type WordStore = {
  currentWord: VocabWord | null
  saved: VocabWord[]
}
