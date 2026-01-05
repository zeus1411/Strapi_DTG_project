/**
 * Redis Configuration
 * All values must be set in .env file
 */

export default {
  host: process.env.REDIS_HOST!,
  port: parseInt(process.env.REDIS_PORT!, 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB!, 10),
  enabled: process.env.REDIS_ENABLED === 'true',
  
  // Retry strategy
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  
  // Default TTL in seconds
  defaultTTL: parseInt(process.env.CACHE_TTL!, 10),
  
  // Max retry attempts
  maxRetriesPerRequest: 3,
};
