
const NodeCache = require('node-cache');

const cache = new NodeCache({ 
  stdTTL: 300, 
  checkperiod: 60, 
  useClones: false 
});

const generateCacheKey = (req) => {
  const { path, query, user } = req;
  const userId = user?.username || user?.email || 'anonymous';
  const queryString = JSON.stringify(query);
  return `cache:${path}:${userId}:${queryString}`;
};

const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const skipCachePaths = ['/api/health', '/api/auth'];
    if (skipCachePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const cacheKey = generateCacheKey(req);
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      res.set('X-Cache', 'HIT');
      return res.json(cachedData);
    }

    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      if (res.statusCode === 200 && data.success !== false) {
        cache.set(cacheKey, data, duration);
      }
      res.set('X-Cache', 'MISS');
      return originalJson(data);
    };

    next();
  };
};

const clearCachePattern = (pattern) => {
  const keys = cache.keys();
  keys.forEach(key => {
    if (key.includes(pattern)) {
      cache.del(key);
    }
  });
};

const clearAllCache = () => {
  cache.flushAll();
};

const getCacheStats = () => {
  return cache.getStats();
};

module.exports = {
  cacheMiddleware,
  clearCachePattern,
  clearAllCache,
  getCacheStats,
  cache 
};

