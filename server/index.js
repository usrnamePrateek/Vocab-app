import 'dotenv/config'
import { createApp } from './app.js'
import { loadDictionary } from './dictionary.js'

const PORT = process.env.PORT || 3001

const count = await loadDictionary()
const app = createApp()

app.listen(PORT, () => {
  console.log(`Vocab Master API on http://localhost:${PORT}`)
  console.log(`Loaded ${count} words from data/dictionary.txt`)
})
