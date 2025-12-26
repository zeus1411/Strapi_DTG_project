import { factories } from '@strapi/strapi';
import fs from 'fs';
import path from 'path';

export default factories.createCoreController('api::category.category', ({ strapi }) => ({
  async getCategoryReport(ctx) {
    try {
      const user = ctx.state.user;
      strapi.log.info(`User accessing Category Report: ${user?.email || 'Public'}`);

      // ✅ Query 1: Get report statistics (TABLE - 1 row)
      const reportResult = await strapi.db.connection.raw(
        'SELECT * FROM get_category_report()'
      );

      // ✅ Query 2: Get top categories (TABLE - nhiều rows)
      const topCategoriesResult = await strapi.db.connection.raw(
        'SELECT * FROM get_top_categories(?)',
        [50] // Limit 50 categories
      );

      const reportData = reportResult.rows[0];
      const topCategories = topCategoriesResult.rows;

      if (!reportData) {
        return ctx.notFound({
          message: 'Function chưa được tạo hoặc không có data',
          guide: 'Xem file: database/OPTIMIZED_PROCEDURES_TABLE_VERSION.sql'
        });
      }

      return ctx.send({
        success: true,
        data: {
          ...reportData,  // ⭐ Spread stats: total_categories, active_categories, etc.
          topCategories   // ⭐ Array of top categories
        },
        meta: {
          generatedAt: new Date().toISOString(),
          user: user ? { email: user.email } : 'Public',
          source: 'PostgreSQL Functions: get_category_report() + get_top_categories()'
        }
      });

    } catch (error) {
      strapi.log.error('Error getting category report:', error);
      
      // Friendly error message
      if (error.message.includes('does not exist')) {
        return ctx.badRequest({
          message: 'Stored function chưa được tạo trong database',
          solution: 'Làm theo hướng dẫn trong: database/OPTIMIZED_PROCEDURES_TABLE_VERSION.sql',
          steps: [
            '1. Mở pgAdmin4',
            '2. Connect vào database: testing_strapi_2',
            '3. Query Tool → Copy SQL từ file OPTIMIZED_PROCEDURES_TABLE_VERSION.sql',
            '4. Execute để tạo functions',
            '5. Thử lại API này'
          ]
        });
      }

      return ctx.internalServerError(`Failed to get report: ${error.message}`);
    }
  },

  /**
   * CATEGORY REPORT PROC - gọi FUNCTION (TABLE version)
   */
  async getCategoryReportProc(ctx) {
    try {
      const user = ctx.state.user;
      strapi.log.info(`User accessing Category Report PROC: ${user?.email || 'Public'}`);
      
      // ✅ Giờ là function, gọi đơn giản như get_category_report
      const reportResult = await strapi.db.connection.raw(
        'SELECT * FROM get_category_report_proc()'
      );

      const topCategoriesResult = await strapi.db.connection.raw(
        'SELECT * FROM get_top_categories(?)',
        [50]
      );

      const reportData = reportResult.rows[0];
      const topCategories = topCategoriesResult.rows;

      if (!reportData) {
        return ctx.notFound({
          message: 'Function chưa được tạo hoặc không có data',
          guide: 'Xem file: database/OPTIMIZED_PROCEDURES_TABLE_VERSION.sql'
        });
      }

      return ctx.send({
        success: true,
        data: {
          ...reportData,
          topCategories
        },
        meta: {
          generatedAt: new Date().toISOString(),
          user: user ? { email: user.email } : 'Public',
          source: 'PostgreSQL Function: get_category_report_proc() + get_top_categories()'
        }
      });

    } catch (error) {
      strapi.log.error('Error calling function:', error);
      return ctx.internalServerError(`Failed to call function: ${error.message}`);
    }
  },

  /**
   * CATEGORY DETAILS - Với Parameters
   */
  async getCategoryDetails(ctx) {
    try {
      const { activeOnly = true, limit = 10 } = ctx.query;

      // Gọi procedure với parameters
      const result = await strapi.db.connection.raw(
        'SELECT * FROM get_category_details(?, ?)',
        [activeOnly === 'true' || activeOnly === true, parseInt(String(limit)) || 10]
      );

      return ctx.send({
        success: true,
        data: result.rows,
        meta: {
          count: result.rows.length,
          filters: { activeOnly, limit },
          source: 'PostgreSQL Stored Procedure: get_category_details()'
        }
      });

    } catch (error) {
      strapi.log.error('Error getting category details:', error);
      
      if (error.message.includes('does not exist')) {
        return ctx.badRequest({
          message: 'Stored function chưa được tạo',
          guide: 'Xem file: database/OPTIMIZED_PROCEDURES_TABLE_VERSION.sql'
        });
      }

      return ctx.internalServerError(`Failed to get details: ${error.message}`);
    }
  },

  /**
   * CUSTOM API - Đọc categories từ file JSON
   * Custom API với permission checking
   */
  async getFromJson(ctx) {
    try {
      // Strapi tự động check permissions nếu config trong routes
      // Hoặc có thể check manual:
      const user = ctx.state.user;
      
      // Log để debug
      strapi.log.info(`User accessing getFromJson API: ${user?.email || 'Public'}`);

      // Đọc file JSON từ thư mục data/
      const jsonPath = path.join(process.cwd(), 'data', 'categories.json');
      
      if (!fs.existsSync(jsonPath)) {
        return ctx.notFound('Categories JSON file not found');
      }

      const jsonData = fs.readFileSync(jsonPath, 'utf-8');
      const data = JSON.parse(jsonData);

      // Có thể filter dựa vào user permissions
      // Ví dụ: chỉ return active categories cho public users
      let categories = data.categories;
      
      if (!user) {
        // Public user chỉ thấy active categories
        categories = categories.filter(cat => cat.isActive === true);
      }

      return ctx.send({
        data: categories,
        meta: {
          source: 'json-file',
          metadata: data.metadata,
          user: user ? { id: user.id, email: user.email } : null
        }
      });
    } catch (error) {
      strapi.log.error('Error reading categories JSON:', error);
      return ctx.internalServerError('Failed to read categories from JSON');
    }
  },

  /**
   * CUSTOM API 2: Import categories từ JSON vào database
   * Yêu cầu authentication - demo việc check quyền
   */
  async importFromJson(ctx) {
    try {
      // Check authentication
      const user = ctx.state.user;
      
      if (!user) {
        return ctx.unauthorized('You must be authenticated to import categories');
      }

      // Debug: Log user structure
      strapi.log.info('=== USER DEBUG INFO ===');
      strapi.log.info('User ID:', user.id);
      strapi.log.info('User Email:', user.email);
      strapi.log.info('User Role:', user.role);
      strapi.log.info('User Roles:', user.roles);
      strapi.log.info('======================');

      // Check quyền - HỖ TRỢ CẢ 2 LOẠI USERS
      let isAdmin = false;
      
      // Case 1: Admin Panel Users (có user.roles array)
      if (user.roles && Array.isArray(user.roles)) {
        isAdmin = user.roles.some(role => 
          role.code === 'strapi-super-admin' || 
          role.code === 'strapi-admin'
        );
        strapi.log.info('Checking Admin Panel user - Is Admin?', isAdmin);
      }
      
      // Case 2: Users-Permissions Users (có user.role object)
      // Check xem role có type/name là 'admin'
      if (!isAdmin && user.role) {
        const roleName = user.role.name?.toLowerCase() || user.role.type?.toLowerCase() || '';
        isAdmin = roleName === 'admin' || roleName === 'administrator';
        strapi.log.info('Checking Users-Permissions user - Role:', roleName, '- Is Admin?', isAdmin);
      }
      
      if (!isAdmin) {
        return ctx.forbidden('Only administrators can import categories. Your role does not have permission.');
      }

      // Đọc file JSON
      const jsonPath = path.join(process.cwd(), 'data', 'categories.json');
      const jsonData = fs.readFileSync(jsonPath, 'utf-8');
      const data = JSON.parse(jsonData);

      // Import vào database
      const importedCategories = [];
      
      // Dùng for...of bình thường (không cần for await vì array không phải async iterable)
      for (const cat of data.categories) {
        // Check xem category đã tồn tại chưa
        const existing = await strapi.db.query('api::category.category').findOne({
          where: { slug: cat.slug }
        });

        if (existing) {
          // Update existing
          const updated = await strapi.db.query('api::category.category').update({
            where: { id: existing.id },
            data: {
              name: cat.name,
              description: cat.description,
              icon: cat.icon,
              order: cat.order,
              isActive: cat.isActive
            }
          });
          importedCategories.push({ action: 'updated', category: updated });
        } else {
          // Create new
          const created = await strapi.db.query('api::category.category').create({
            data: {
              name: cat.name,
              slug: cat.slug,
              description: cat.description,
              icon: cat.icon,
              order: cat.order,
              isActive: cat.isActive
            }
          });
          importedCategories.push({ action: 'created', category: created });
        }
      }

      return ctx.send({
        message: 'Categories imported successfully',
        data: importedCategories,
        meta: {
          total: importedCategories.length,
          importedBy: { id: user.id, email: user.email }
        }
      });
    } catch (error) {
      strapi.log.error('Error importing categories:', error);
      return ctx.internalServerError('Failed to import categories');
    }
  }
}));
