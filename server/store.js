import { MongoClient } from 'mongodb'

const STORE_ID = 'default'

let clientPromise = null

function getUri() {
  const uri = process.env.MONGODB_URI?.trim()
  if (!uri) {
    throw new Error(
      'Missing MONGODB_URI. Add it to .env locally and to Vercel Environment Variables.',
    )
  }
  return uri
}

async function getClient() {
  if (!clientPromise) {
    clientPromise = MongoClient.connect(getUri()).catch((err) => {
      clientPromise = null
      throw err
    })
  }
  return clientPromise
}

async function getCollection() {
  const client = await getClient()
  const dbName = process.env.MONGODB_DB || 'vocab_master'
  return client.db(dbName).collection('store')
}

export async function readStore() {
  const col = await getCollection()
  const doc = await col.findOne({ _id: STORE_ID })
  if (!doc) {
    return { currentWord: null, saved: [] }
  }
  return {
    currentWord: doc.currentWord ?? null,
    saved: Array.isArray(doc.saved) ? doc.saved : [],
  }
}

export async function writeStore(store) {
  const col = await getCollection()
  await col.updateOne(
    { _id: STORE_ID },
    {
      $set: {
        currentWord: store.currentWord ?? null,
        saved: store.saved ?? [],
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  )
}
