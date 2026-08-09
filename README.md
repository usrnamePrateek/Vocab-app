# Vocab Master

A mobile-friendly React app that serves a daily vocabulary word (or a new one on demand), shows its meaning and an example sentence, and asks you to write your own sentence.

Words are persisted in `data/words.json` via a small local Express API.

## Run

```bash
npm install
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:3001

Words are picked randomly from `data/dictionary.txt` (a common English word list) and definitions come from the [Free Dictionary API](https://dictionaryapi.dev/).
