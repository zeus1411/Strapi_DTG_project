module.exports = (plugin) => {
  // Override user find controller to filter by department
  const originalFind = plugin.controllers.user.find;
  
  plugin.controllers.user.find = async (ctx) => {
    const currentUser = ctx.state.user;

    if (currentUser) {
      // Fetch user with department and role
      const userWithDept = await strapi.entityService.findOne(
        'plugin::users-permissions.user',
        currentUser.id,
        { populate: ['department', 'role'] }
      );

      // Check if Super Admin (type='admin')
      const isSuperAdmin = userWithDept?.role?.type === 'admin';

      // If NOT admin and has department, filter by same department
      if (!isSuperAdmin && userWithDept?.department?.id) {
        ctx.query = {
          ...ctx.query,
          filters: {
            ...ctx.query.filters,
            department: { id: userWithDept.department.id },
          },
        };
      }
    }

    return await originalFind(ctx);
  };

  return plugin;
};
