import type { Core } from '@strapi/strapi';
import redisService, { type RedisService } from './services/redis.js';
import redisConfig from '../config/redis.js';
import cacheInvalidationLifecycles from './lifecycles/cache-invalidation.js';

declare global {
  var redisService: RedisService;
}

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   */
  async register({ strapi }: { strapi: Core.Strapi }) {
    // Register cache invalidation lifecycles
    await cacheInvalidationLifecycles.register({ strapi });
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Initialize Redis
    try {
      await redisService.initialize(redisConfig);
      global.redisService = redisService;
      
      if (redisService.isAvailable()) {
        strapi.log.info('✅ Redis cache service initialized successfully');
      } else {
        strapi.log.warn('⚠️  Redis is disabled or unavailable - running without cache');
      }
    } catch (error) {
      strapi.log.error('❌ Failed to initialize Redis:', error);
      strapi.log.warn('⚠️  Continuing without cache...');
    }
  },
};
