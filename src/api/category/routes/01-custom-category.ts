export default {
  routes: [
    // CATEGORY REPORT - Stored Procedure Demo
    {
      method: 'GET',
      path: '/categories/report',
      handler: 'category.getCategoryReport',
      config: {
        description: 'Get category report (using FUNCTION)',
        tag: {
          plugin: 'api',
          name: 'Category Report'
        }
      }
    },

    // CATEGORY REPORT PROC - Demo gọi PROCEDURE thực sự
    {
      method: 'GET',
      path: '/categories/report-proc',
      handler: 'category.getCategoryReportProc',
      config: {
        description: 'Get category report (using PROCEDURE)',
        tag: {
          plugin: 'api',
          name: 'Category Report'
        }
      }
    },

    // CATEGORY DETAILS - Stored Procedure với Parameters
    {
      method: 'GET',
      path: '/categories/details',
      handler: 'category.getCategoryDetails',
      config: {
        description: 'Get category details with filters (using Function)',
        tag: {
          plugin: 'api',
          name: 'Category Report'
        }
      }
    },

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