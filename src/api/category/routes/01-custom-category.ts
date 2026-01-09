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
    },

    // GENERIC DATABASE FUNCTION CALLER - GET
    {
      method: 'GET',
      path: '/categories/db/call-function',
      handler: 'category.callDatabaseFunction',
      config: {
        auth: false,
        description: 'Generic database function caller (GET) - Named Parameters',
        tag: {
          plugin: 'api',
          name: 'Database Functions'
        }
      }
    },

    // GENERIC DATABASE FUNCTION CALLER - POST
    {
      method: 'POST',
      path: '/categories/db/call-function',
      handler: 'category.callDatabaseFunctionPost',
      config: {
        auth: false,
        description: 'Generic database function caller (POST) - Named Parameters',
        tag: {
          plugin: 'api',
          name: 'Database Functions'
        }
      }
    }
  ]
};