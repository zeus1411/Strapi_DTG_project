/**
 * GLOBAL POLICY: is-admin
 * 
 * Có thể dùng cho BẤT KỲ API nào trong project
 * 
 * Usage trong routes:
 * policies: ['global::is-admin']
 * 
 * Hỗ trợ cả 2 loại users:
 * - Admin Panel users (super-admin, admin)
 * - Users-Permissions users (role name = "admin")
 */

export default (policyContext, config, { strapi }) => {
  const { state } = policyContext;
  const user = state.user;

  // Log để debug
  strapi.log.info('[Global Policy: is-admin] Checking admin permission');

  // Nếu chưa đăng nhập
  if (!user) {
    strapi.log.info('[Global Policy: is-admin] User not authenticated');
    return false;
  }

  let isAdmin = false;

  // Case 1: Admin Panel Users (có user.roles array)
  if (user.roles && Array.isArray(user.roles)) {
    isAdmin = user.roles.some(role => 
      role.code === 'strapi-super-admin' || 
      role.code === 'strapi-admin'
    );
  }

  // Case 2: Users-Permissions Users (có user.role object)
  if (!isAdmin && user.role) {
    const roleName = user.role.name?.toLowerCase() || user.role.type?.toLowerCase() || '';
    isAdmin = roleName === 'admin' || roleName === 'administrator';
  }

  strapi.log.info(`[Global Policy: is-admin] User: ${user.email || user.id} - Is Admin: ${isAdmin}`);

  return isAdmin;
};
