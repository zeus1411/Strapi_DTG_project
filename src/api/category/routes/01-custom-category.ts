export default {
  routes: [
    // PUBLIC API - Không cần authentication
    {
      method: 'GET',
      path: '/categories/from-json',
      handler: 'category.getFromJson',
      config: {
        auth: false,
        description: 'Get categories from JSON file (public)',
        tag: {
          plugin: 'api',
          name: 'Category'
        }
      }
    },

    // IMPORT FROM JSON
    {
      method: 'POST',
      path: '/categories/import-from-json',
      handler: 'category.importFromJson',
      config: {
        description: 'Import categories from JSON to database',
        tag: {
          plugin: 'api',
          name: 'Category'
        }
      }
    }
  ]
};