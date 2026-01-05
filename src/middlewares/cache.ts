/**
 * Dynamic Cache Middleware - Reads rules from Database
 * Rules are managed via Admin Panel (Cache Rule Content Type)
 */

// Cache for rules to avoid DB query on every request
let cachedRules = null;
let lastRulesFetch = 0;
const RULES_CACHE_TTL = 60000; // 1 minute

export default (config, { strapi }) => {
  return async (ctx, next) => {
    // Skip admin routes and non-API routes
    if (!ctx.url.startsWith('/api/') || ctx.url.startsWith('/api/cache-rules')) {
      return next();
    }

    const redis = global.redisService;
    if (!redis || !redis.isAvailable()) {
      return next();
    }

    // Get cache rules from DB (with caching)
    const now = Date.now();
    if (!cachedRules || (now - lastRulesFetch) > RULES_CACHE_TTL) {
      try {
        cachedRules = await strapi.entityService.findMany('api::cache-rule.cache-rule' as any, {
          filters: { enabled: true },
          sort: { priority: 'desc' }
        });
        lastRulesFetch = now;
      } catch (error) {
        // If cache-rule table doesn't exist yet, skip
        strapi.log.debug('Cache rules not loaded:', error.message);
        return next();
      }
    }

    // Find matching rule
    const matchedRule: any = cachedRules?.find((rule: any) => {
      // Trim pattern to avoid whitespace issues
      const pattern = rule.routePattern?.trim() || '';
      
      // Check method
      if (rule.method !== 'ALL' && rule.method !== ctx.method) {
        return false;
      }
      
      // Check route pattern
      return matchRoutePattern(ctx.url, pattern);
    });

    // If no rule matches, skip caching
    if (!matchedRule) {
      return next();
    }

    // Only cache GET requests by default
    if (ctx.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const cacheKey = `api:${ctx.url}`;

    try {
      // Try to get from cache
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        // Cache HIT
        ctx.body = cached;
        ctx.set('X-Cache', 'HIT');
        ctx.set('X-Cache-Rule', matchedRule.name);
        ctx.set('X-Cache-TTL', String(matchedRule.ttl));

        // Update statistics
        updateRuleStats(strapi, matchedRule.id, 'hit');
        
        return;
      }

      // Cache MISS - continue to controller
      await next();

      // Only cache successful responses
      if (ctx.status === 200 && ctx.body) {
        await redis.set(cacheKey, ctx.body, matchedRule.ttl);
        ctx.set('X-Cache', 'MISS');
        ctx.set('X-Cache-Rule', matchedRule.name);
        ctx.set('X-Cache-TTL', String(matchedRule.ttl));

        // Update statistics
        updateRuleStats(strapi, matchedRule.id, 'miss');
      }
    } catch (error) {
      strapi.log.error('Cache middleware error:', error);
      return next();
    }
  };
};

/**
 * Match URL against route pattern
 */
function matchRoutePattern(url: string, pattern: string): boolean {
  // Remove query params for matching
  const urlPath = url.split('?')[0];
  
  // Convert pattern to regex
  // /api/courses -> ^/api/courses$
  // /api/courses/* -> ^/api/courses/.*$
  // /api/*/list -> ^/api/.*/list$
  
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\//g, '\\/');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(urlPath);
}

/**
 * Update rule statistics (async, don't block request)
 */
function updateRuleStats(strapi: any, ruleId: number, type: 'hit' | 'miss') {
  // Run async without blocking
  setImmediate(async () => {
    try {
      const rule = await strapi.entityService.findOne('api::cache-rule.cache-rule', ruleId);
      if (!rule) return;

      const stats = rule.statistics || { hits: 0, misses: 0, lastUpdated: null };
      
      if (type === 'hit') {
        stats.hits = (stats.hits || 0) + 1;
      } else {
        stats.misses = (stats.misses || 0) + 1;
      }
      
      stats.lastUpdated = new Date().toISOString();

      await strapi.entityService.update('api::cache-rule.cache-rule', ruleId, {
        data: { statistics: stats }
      });
    } catch (error) {
      // Silent fail - don't affect requests
      strapi.log.debug('Failed to update cache stats:', error.message);
    }
  });
}
