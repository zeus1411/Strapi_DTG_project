/**
 * Middleware: Dynamic Bucket Selector
 * Intercepts upload requests và routing đến đúng bucket
 */

export default (config, { strapi }) => {
  return async (ctx, next) => {
    // Chỉ xử lý upload requests
    if (ctx.request.url.startsWith('/api/upload') && ctx.request.method === 'POST') {
      // Lấy bucket từ form-data hoặc query params
      const bucketFromBody = ctx.request.body?.bucket;
      const bucketFromQuery = ctx.query?.bucket;
      const requestedBucket = bucketFromBody || bucketFromQuery;
      
      strapi.log.info(`[Bucket Selector] Intercepted upload - bucket: ${requestedBucket}`);
      
      if (requestedBucket === 'private' || requestedBucket === 'strapi-private') {
        // Lưu bucket gốc để restore sau
        ctx.state.originalBucket = strapi.config.get('plugin.upload.providerOptions.params.Bucket');
        
        // Override sang private bucket
        strapi.config.set('plugin.upload.providerOptions.params.Bucket', process.env.MINIO_BUCKET_PRIVATE);
        strapi.log.info(`[Bucket Selector] Switched to PRIVATE bucket: ${process.env.MINIO_BUCKET_PRIVATE}`);
      }
    }
    
    await next();
    
    // Restore bucket gốc sau khi request hoàn thành
    if (ctx.state.originalBucket) {
      strapi.config.set('plugin.upload.providerOptions.params.Bucket', ctx.state.originalBucket);
      strapi.log.info(`[Bucket Selector] Restored original bucket`);
    }
  };
};
