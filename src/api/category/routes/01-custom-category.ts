/**
 * category routes
 * 
 * GIẢI THÍCH: File này config routes cho Category API
 * - CRUD routes: tự động từ createCoreRouter (có sẵn permission checking)
 * - Custom routes: phải config permission manual
 * 
 * POLICIES:
 * - Local policy:  'api::category.check-permission'   ← Chỉ dùng cho category
 * - Global policy: 'global::is-admin'                 ← Dùng cho TẤT CẢ APIs
 */

export default {
  routes: [
    // CATEGORY REPORT - Stored Procedure Demo
    {
      method: 'GET',
      path: '/categories/report',
      handler: 'category.getCategoryReport',
      config: {
        // auth: false,  // Public để dễ test
        policies: ['global::is-admin'],
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
        policies: ['global::is-admin'],
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
        // auth: false,
        policies: ['global::is-admin'],
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
        // Cho phép public access (không cần policies)
        auth: false,
        
        // Nếu muốn bật policies, comment dòng "auth: false" ở trên và uncomment 1 trong các cách dưới:
        
        // CÁCH 1: Yêu cầu đăng nhập (authenticated users)
        // policies: ['global::is-authenticated'],
        
        // CÁCH 2: Chỉ admin mới truy cập được
        // policies: ['global::is-admin'],
        
        // CÁCH 3: Yêu cầu role cụ thể
        // policies: [
        //   {
        //     name: 'global::has-role',
        //     config: { roles: ['admin', 'editor'] }
        //   }
        // ],
        
        description: 'Get categories from JSON file (public)',
        tag: {
          plugin: 'api',
          name: 'Category'
        }
      }
    },

    // ==========================================
    // ADMIN-ONLY API - Dùng GLOBAL POLICY
    // ==========================================
    {
      method: 'POST',
      path: '/categories/import-from-json',
      handler: 'category.importFromJson',
      config: {
        policies: ['global::is-admin'],
        description: 'Import categories from JSON to database (admin only)',
        tag: {
          plugin: 'api',
          name: 'Category'
        }
      }
    }
  ]
};