import { createApp } from '../server/app.js'
import { loadDictionary } from '../server/dictionary.js'

await loadDictionary()

export default createApp()
