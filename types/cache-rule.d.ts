/**
 * Manual Type Definitions for cache-rule content type
 * This will be replaced by auto-generated types after first successful build
 */

import '@strapi/strapi';

declare module '@strapi/strapi' {
  export namespace Strapi {
    export interface Api {
      'cache-rule': {
        'cache-rule': {
          name: string;
          routePattern: string;
          method: 'GET';
          enabled: boolean;
          ttl: number;
          priority?: number;
          statistics?: {
            hits: number;
            misses: number;
            lastAccessed?: string;
          };
        };
      };
    }
  }
}
