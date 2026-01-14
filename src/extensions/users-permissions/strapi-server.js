module.exports = (plugin) => {
  // Override user find controller to filter by orgunit
  const originalFind = plugin.controllers.user.find;
  
  plugin.controllers.user.find = async (ctx) => {
    const currentUser = ctx.state.user;

    if (currentUser) {
      // Fetch user with orgunit and role
      const userWithDept = await strapi.entityService.findOne(
        'plugin::users-permissions.user',
        currentUser.id,
        { populate: ['orgunit', 'role'] }
      );

      // Check if Super Admin (type='admin')
      const isSuperAdmin = userWithDept?.role?.type === 'admin';

      // If NOT admin and has orgunit, filter by same orgunit
      if (!isSuperAdmin && userWithDept?.orgunit?.id) {
        ctx.query = {
          ...ctx.query,
          filters: {
            ...ctx.query.filters,
            orgunit: { id: userWithDept.orgunit.id },
          },
        };
      }
    }

    return await originalFind(ctx);
  };

  return plugin;
};
