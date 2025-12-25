/**
 * GLOBAL POLICY: has-role
 * 
 * Check xem user có role cụ thể không
 * 
 * Usage trong routes:
 * policies: [
 *   {
 *     name: 'global::has-role',
 *     config: { roles: ['admin', 'editor'] }
 *   }
 * ]
 */

export default (policyContext, config, { strapi }) => {
  const { state } = policyContext;
  const user = state.user;
  const requiredRoles = config.roles || [];

  strapi.log.info('[Global Policy: has-role] Checking role permission');
  strapi.log.info(`[Global Policy: has-role] Required roles: ${requiredRoles.join(', ')}`);

  if (!user) {
    strapi.log.info('[Global Policy: has-role] User not authenticated');
    return false;
  }

  let userRoleName = '';

  // Check Admin Panel users
  if (user.roles && Array.isArray(user.roles)) {
    userRoleName = user.roles[0]?.code || '';
  }

  // Check Users-Permissions users
  if (!userRoleName && user.role) {
    userRoleName = user.role.name?.toLowerCase() || user.role.type?.toLowerCase() || '';
  }

  const hasRequiredRole = requiredRoles.some(role => 
    userRoleName.toLowerCase().includes(role.toLowerCase())
  );

  strapi.log.info(`[Global Policy: has-role] User role: ${userRoleName} - Has required role: ${hasRequiredRole}`);

  return hasRequiredRole;
};
