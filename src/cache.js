const cache = new Map();
const DEFAULT_TTL_MS = Number(process.env.CACHE_TTL_MS || 30000);

const now = () => Date.now();

const shouldUseCache = (ttl) => ttl !== 0 && ttl !== '0' && ttl !== null && ttl !== undefined;

const makeKey = (src, tgt) => `${src}:${tgt}`;

export const getCached = (src, tgt) => {
  const key = makeKey(src, tgt);
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires <= now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
};

export const setCached = (src, tgt, value, ttlMs = DEFAULT_TTL_MS) => {
  if (!shouldUseCache(ttlMs)) return;
  const key = makeKey(src, tgt);
  cache.set(key, { value, expires: now() + ttlMs });
};

export const invalidateCache = (src, tgt) => {
  cache.delete(makeKey(src, tgt));
};

export const clearCache = () => cache.clear();

export default {
  getCached,
  setCached,
  invalidateCache,
  clearCache
};
