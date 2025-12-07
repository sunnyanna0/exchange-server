import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

let client;
let db;

const DEFAULT_DB_NAME = process.env.DB_NAME || 'exchange';
const DEFAULT_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const COLLECTION = 'exchangeRates';

const defaultSeed = [
  { src: 'usd', tgt: 'krw', rate: 1342.11, date: '2022-11-28' },
  { src: 'krw', tgt: 'usd', rate: 0.0007450954094671824, date: '2022-11-28' },
  { src: 'usd', tgt: 'usd', rate: 1, date: '2022-11-28' },
  { src: 'krw', tgt: 'krw', rate: 1, date: '2022-11-28' }
];

export const formatDate = (value = new Date()) => {
  const iso = new Date(value).toISOString();
  return iso.slice(0, 10);
};

export const toCurrencyCode = (value) => value?.trim().toLowerCase();

const ensureSeedData = async () => {
  const collection = getCollection();
  await collection.createIndex({ src: 1, tgt: 1, date: 1 }, { unique: true });

  const bulk = collection.initializeUnorderedBulkOp();
  defaultSeed.forEach((item) => {
    bulk.find({ src: item.src, tgt: item.tgt, date: item.date }).upsert().updateOne({ $setOnInsert: item });
  });
  try {
    await bulk.execute();
  } catch (err) {
    // ignore duplicate key errors on seed
    if (err.code !== 11000) {
      throw err;
    }
  }
};

export const connectDB = async () => {
  if (db) return db;

  client = new MongoClient(DEFAULT_URI, { ignoreUndefined: true });
  await client.connect();
  db = client.db(DEFAULT_DB_NAME);
  await ensureSeedData();

  return db;
};

export const getCollection = () => {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB() first.');
  }
  return db.collection(COLLECTION);
};

export const closeDB = async () => {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
};
