/**
 * Populate Comma Middleware
 *
 * Swagger UI (and some clients) only expose a single input for `populate`.
 * Strapi supports arrays/objects for `populate`, but those are awkward to enter
 * via Swagger query params. This middleware allows a convenient syntax:
 *
 *   ?populate=relA,relB,relC
 *
 * and converts it into:
 *
 *   ctx.query.populate = ['relA', 'relB', 'relC']
 */

export default (_config, { strapi }) => {
  return async (ctx, next) => {
    try {
      const populate = ctx.query?.populate;

      if (typeof populate === 'string') {
        const trimmed = populate.trim();

        // Keep Strapi's special wildcard as-is
        if (trimmed !== '*' && trimmed.includes(',') && !trimmed.includes('[')) {
          const items = trimmed
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);

          // Only rewrite when it actually represents multiple items
          if (items.length > 1) {
            ctx.query.populate = items;
          }
        }
      }
    } catch (error) {
      // Never block requests because of query rewriting
      strapi?.log?.debug('populate-comma middleware skipped:', error?.message);
    }

    return next();
  };
};
