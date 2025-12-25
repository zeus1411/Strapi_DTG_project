/**
 * GLOBAL POLICY: is-authenticated
 * 
 * Check xem user đã đăng nhập chưa
 * 
 * Usage trong routes:
 * policies: ['global::is-authenticated']
 */

export default (policyContext, config, { strapi }) => {
  const { state } = policyContext;
  const user = state.user;

  strapi.log.info('[Global Policy: is-authenticated] Checking authentication');

  if (!user) {
    strapi.log.info('[Global Policy: is-authenticated] User not authenticated');
    return false;
  }

  strapi.log.info(`[Global Policy: is-authenticated] User authenticated: ${user.email || user.id}`);
  return true;
};
