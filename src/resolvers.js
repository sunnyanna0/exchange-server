import { getCached, invalidateCache, setCached } from './cache.js';
import { formatDate, getCollection, toCurrencyCode } from './db.js';

const findLatestRate = async (src, tgt) => {
  const collection = getCollection();
  const cursor = collection.find({ src, tgt }).sort({ date: -1 }).limit(1);
  const docs = await cursor.toArray();
  return docs[0] || null;
};

export const resolvers = {
  Query: {
    getExchangeRate: async (_, { src, tgt }) => {
      const normalizedSrc = toCurrencyCode(src);
      const normalizedTgt = toCurrencyCode(tgt);
      if (!normalizedSrc || !normalizedTgt) {
        throw new Error('src and tgt are required');
      }

      const cached = getCached(normalizedSrc, normalizedTgt);
      if (cached) return cached;

      const existing = await findLatestRate(normalizedSrc, normalizedTgt);
      if (existing) {
        setCached(normalizedSrc, normalizedTgt, existing);
        return existing;
      }

      if (normalizedSrc === normalizedTgt) {
        const sameCurrency = {
          src: normalizedSrc,
          tgt: normalizedTgt,
          rate: 1,
          date: formatDate()
        };
        setCached(normalizedSrc, normalizedTgt, sameCurrency);
        return sameCurrency;
      }

      return null;
    }
  },
  Mutation: {
    postExchangeRate: async (_, { info }) => {
      if (!info) throw new Error('info is required');
      const src = toCurrencyCode(info.src);
      const tgt = toCurrencyCode(info.tgt);
      const date = info.date ? formatDate(info.date) : formatDate();

      if (!src || !tgt) throw new Error('src and tgt are required');

      const rate = src === tgt ? 1 : info.rate;
      const collection = getCollection();

      await collection.updateOne(
        { src, tgt, date },
        { $set: { src, tgt, rate, date, updatedAt: new Date() } },
        { upsert: true }
      );

      invalidateCache(src, tgt);
      return { src, tgt, rate, date };
    },
    deleteExchangeRate: async (_, { info }) => {
      const src = toCurrencyCode(info?.src);
      const tgt = toCurrencyCode(info?.tgt);
      const date = formatDate(info?.date);
      if (!src || !tgt || !date) throw new Error('src, tgt, date are required');

      const collection = getCollection();
      const deleted = await collection.findOneAndDelete({ src, tgt, date });
      invalidateCache(src, tgt);
      if (!deleted) return null;
      // driver may return the doc directly or under `value`
      return deleted.value ?? deleted;
    }
  }
};

export default resolvers;
