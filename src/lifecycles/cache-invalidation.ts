/**
 * Global Lifecycle Hooks - Auto Invalidate Cache
 * Tự động xóa cache khi có create/update/delete
 */

export default {
  /**
   * Register lifecycle hooks for all content types
   */
  async register({ strapi }) {
    // Get all content types
    const contentTypes = Object.keys(strapi.contentTypes);

    for (const uid of contentTypes) {
      // Skip internal types
      if (uid.startsWith('admin::') || uid.startsWith('plugin::')) {
        continue;
      }

      // Register hooks
      strapi.db.lifecycles.subscribe({
        models: [uid],

        async afterCreate(event) {
          await invalidateCacheForModel(strapi, uid, event);
        },

        async afterUpdate(event) {
          await invalidateCacheForModel(strapi, uid, event);
        },

        async afterDelete(event) {
          await invalidateCacheForModel(strapi, uid, event);
        },
      });
    }

    strapi.log.info('✅ Cache invalidation lifecycle hooks registered');
  }
};

/**
 * Invalidate cache based on model changes
 */
async function invalidateCacheForModel(strapi: any, uid: string, event: any) {
  const redis = global.redisService;
  if (!redis || !redis.isAvailable()) {
    return;
  }

  try {
    // Extract model name from UID (e.g., api::course.course -> course)
    const modelName = uid.split('.').pop();

    // Find all cache rules that should be invalidated for this model
    const rules: any[] = await strapi.entityService.findMany('api::cache-rule.cache-rule' as any, {
      filters: { enabled: true }
    });

    for (const rule of rules) {
      // Auto-detect model from routePattern
      const detectedModel = extractModelFromRoute(rule.routePattern);
      
      if (!detectedModel) {
        strapi.log.debug(`[Cache] Rule "${rule.name}": Cannot auto-detect model from route "${rule.routePattern}" - skipping`);
        continue;
      }
      
      strapi.log.debug(`[Cache] Rule "${rule.name}": Auto-detected model "${detectedModel}" from route "${rule.routePattern}"`);
      
      const shouldInvalidate = detectedModel === modelName;
      
      if (shouldInvalidate) {
        const pattern = `*${rule.routePattern}*`;
        const deleted = await redis.delPattern(pattern);
        
        if (deleted > 0) {
          strapi.log.info(`🗑️  Invalidated ${deleted} cache keys for rule: ${rule.name} (model: ${modelName})`);
        }
      }
    }
  } catch (error) {
    strapi.log.debug('Cache invalidation error:', error.message);
  }
}

/**
 * Extract model name from route pattern
 * Examples:
 *   /api/courses -> course
 *   /api/categories/details -> category
 *   /api/products/* -> product
 */
function extractModelFromRoute(routePattern: string): string | null {
  // Match pattern: /api/{modelName}/... or /api/{modelName}
  const match = routePattern.match(/^\/api\/([^\/\*]+)/);
  if (match && match[1]) {
    // Remove trailing 's' if exists (courses -> course, categories -> category)
    let modelName = match[1];
    if (modelName.endsWith('ies')) {
      // categories -> category, stories -> story
      modelName = modelName.slice(0, -3) + 'y';
    } else if (modelName.endsWith('s')) {
      // courses -> course, products -> product
      modelName = modelName.slice(0, -1);
    }
    return modelName;
  }
  return null;
}
