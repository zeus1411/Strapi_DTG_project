/**
 * Redis Service - Singleton Pattern
 * Provides centralized Redis client management
 */

import Redis from 'ioredis';

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  enabled: boolean;
  retryStrategy?: (times: number) => number;
  defaultTTL: number;
  maxRetriesPerRequest?: number;
}

class RedisService {
  private client: Redis | null = null;
  private config: RedisConfig | null = null;
  private isEnabled = false;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };

  /**
   * Initialize Redis connection
   */
  async initialize(config: RedisConfig): Promise<void> {
    this.config = config;
    this.isEnabled = config.enabled;

    if (!this.isEnabled) {
      console.log('⚠️  Redis is disabled via config');
      return;
    }

    try {
      this.client = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db,
        retryStrategy: config.retryStrategy,
        maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
        lazyConnect: true,
      });

      // Connect with timeout
      await Promise.race([
        this.client.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
        ),
      ]);

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis is ready to accept commands');
      });

    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      this.isEnabled = false;
      this.client = null;
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.isEnabled && this.client !== null && this.client.status === 'ready';
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.isAvailable()) return null;

    try {
      const value = await this.client!.get(key);
      if (value) {
        this.stats.hits++;
        return JSON.parse(value) as T;
      }
      this.stats.misses++;
      return null;
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const serialized = JSON.stringify(value);
      const effectiveTTL = ttl || this.config!.defaultTTL;

      if (effectiveTTL > 0) {
        await this.client!.setex(key, effectiveTTL, serialized);
      } else {
        await this.client!.set(key, serialized);
      }

      this.stats.sets++;
      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  }

  /**
   * Delete keys by pattern
   */
  async delPattern(pattern: string): Promise<number> {
    if (!this.isAvailable()) return 0;

    try {
      const keys = await this.client!.keys(pattern);
      if (keys.length === 0) return 0;

      const deleted = await this.client!.del(...keys);
      this.stats.deletes += deleted;
      return deleted;
    } catch (error) {
      console.error('Redis DEL PATTERN error:', error);
      return 0;
    }
  }
}

// Export singleton instance
const redisServiceInstance = new RedisService();
export default redisServiceInstance;
export type { RedisService };
