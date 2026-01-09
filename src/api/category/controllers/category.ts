import { factories } from '@strapi/strapi';
import fs from 'fs';
import path from 'path';

// Helper: Get function/procedure metadata from PostgreSQL catalog
async function getFunctionMetadata(functionName: string) {
  try {
    const result = await strapi.db.connection.raw(`
      SELECT 
        p.proname as function_name,
        p.prokind as kind,
        p.pronargs as num_params,
        COALESCE(
          (SELECT ARRAY_AGG(format_type(t.oid, NULL) ORDER BY ord)
           FROM unnest(p.proargtypes) WITH ORDINALITY AS t(oid, ord)),
          ARRAY[]::text[]
        ) as param_types,
        COALESCE(
          (SELECT ARRAY_AGG(p.proargnames[ord] ORDER BY ord)
           FROM unnest(p.proargtypes) WITH ORDINALITY AS t(oid, ord)),
          ARRAY[]::text[]
        ) as param_names
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' 
        AND p.proname = ?
      LIMIT 1
    `, [functionName]);

    if (result.rows.length === 0) {
      return null;
    }

    const metadata = result.rows[0];
    const paramNames = metadata.param_names || [];
    const paramTypes = metadata.param_types || [];
    
    return {
      functionName: metadata.function_name,
      kind: metadata.kind, // 'f' = function, 'p' = procedure
      isFunction: metadata.kind === 'f',
      isProcedure: metadata.kind === 'p',
      numParams: metadata.num_params,
      parameters: paramNames.map((name: string, index: number) => ({
        name,
        type: paramTypes[index] || 'unknown',
        position: index + 1
      }))
    };
  } catch (error) {
    strapi.log.error('Error getting function metadata:', error);
    return null;
  }
}

// Helper: Convert parameter type
function convertParamType(value: any, type: string) {
  if (value === null || value === undefined) return null;
  
  const typeStr = String(type).toLowerCase();
  
  if (typeStr.includes('int') || typeStr.includes('serial')) {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
  
  if (typeStr.includes('numeric') || typeStr.includes('decimal') || typeStr.includes('real') || typeStr.includes('double')) {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
  
  if (typeStr.includes('bool')) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return Boolean(value);
  }
  
  if (typeStr.includes('date') || typeStr.includes('time')) {
    return value;
  }
  
  return String(value);
}

// Helper: Map named parameters to positional parameters
function mapNamedToPositionalParams(namedParams: any, parameterMetadata: any[]) {
  const orderedParams: any[] = [];
  
  for (const paramInfo of parameterMetadata) {
    const value = namedParams[paramInfo.name];
    
    if (value === undefined || value === null) {
      orderedParams.push(null);
    } else {
      orderedParams.push(convertParamType(value, paramInfo.type));
    }
  }
  
  return orderedParams;
}

export default factories.createCoreController('api::category.category', ({ strapi }) => ({
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
  },

  /**
   * GENERIC DATABASE FUNCTION CALLER - GET
   */
  async callDatabaseFunction(ctx) {
    try {
      const { functionName, params } = ctx.query;

      if (!functionName) {
        return ctx.badRequest('Missing functionName parameter');
      }

      let parsedParams = {};
      if (params) {
        try {
          parsedParams = typeof params === 'string' ? JSON.parse(params) : params;
        } catch (e) {
          return ctx.badRequest(`Invalid JSON in params: ${e.message}`);
        }
      }

      const functionMetadata = await getFunctionMetadata(String(functionName));
      
      if (!functionMetadata) {
        return ctx.notFound(`Function or Procedure '${functionName}' not found in database`);
      }

      const orderedParams = mapNamedToPositionalParams(parsedParams, functionMetadata.parameters);
      
      let result;
      
      if (functionMetadata.isFunction) {
        // Function: SELECT * FROM function_name(params)
        const placeholders = orderedParams.map(() => '?').join(', ');
        const query = `SELECT * FROM ${functionName}(${placeholders})`;
        result = await strapi.db.connection.raw(query, orderedParams);
      } else if (functionMetadata.isProcedure) {
        // Procedure: CALL procedure_name(params) + query temp tables
        const placeholders = orderedParams.map(() => '?').join(', ');
        const callQuery = `CALL ${functionName}(${placeholders})`;
        
        // Execute procedure
        await strapi.db.connection.raw(callQuery, orderedParams);
        
        // Query temp tables with naming convention
        const tempTables = [
          `temp_proc_report_stats`,
          `temp_proc_top_categories`,
          `temp_proc_${functionName}_result`
        ];
        
        const tempData: any = {};
        for (const tableName of tempTables) {
          try {
            const tempResult = await strapi.db.connection.raw(`SELECT * FROM ${tableName}`);
            if (tempResult.rows && tempResult.rows.length > 0) {
              tempData[tableName.replace('temp_proc_', '')] = tempResult.rows;
            }
          } catch (e) {
            // Table doesn't exist, skip
          }
        }
        
        if (Object.keys(tempData).length === 0) {
          return ctx.send({
            success: true,
            message: 'Procedure executed successfully',
            meta: {
              functionName,
              type: 'procedure',
              parametersUsed: parsedParams,
              note: 'Procedure executed but no standard temp tables found'
            }
          });
        }
        
        return ctx.send({
          success: true,
          data: tempData,
          meta: {
            functionName,
            type: 'procedure',
            parametersUsed: parsedParams,
            generatedAt: new Date().toISOString()
          }
        });
      }

      return ctx.send({
        success: true,
        data: result.rows,
        meta: {
          functionName,
          type: 'function',
          parametersUsed: parsedParams,
          resultCount: result.rows.length,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      strapi.log.error('Error calling database function:', error);
      return ctx.internalServerError(`Failed to call function: ${error.message}`);
    }
  },

  /**
   * GENERIC DATABASE FUNCTION CALLER - POST
   */
  async callDatabaseFunctionPost(ctx) {
    try {
      const { functionName, params } = ctx.request.body;

      if (!functionName) {
        return ctx.badRequest('Missing functionName in request body');
      }

      let parsedParams = {};
      if (params) {
        parsedParams = typeof params === 'string' ? JSON.parse(params) : params;
      }

      const functionMetadata = await getFunctionMetadata(String(functionName));
      
      if (!functionMetadata) {
        return ctx.notFound(`Function or Procedure '${functionName}' not found in database`);
      }

      const orderedParams = mapNamedToPositionalParams(parsedParams, functionMetadata.parameters);
      
      let result;
      
      if (functionMetadata.isFunction) {
        // Function: SELECT * FROM function_name(params)
        const placeholders = orderedParams.map(() => '?').join(', ');
        const query = `SELECT * FROM ${functionName}(${placeholders})`;
        result = await strapi.db.connection.raw(query, orderedParams);
      } else if (functionMetadata.isProcedure) {
        // Procedure: CALL procedure_name(params) + query temp tables
        const placeholders = orderedParams.map(() => '?').join(', ');
        const callQuery = `CALL ${functionName}(${placeholders})`;
        
        // Execute procedure
        await strapi.db.connection.raw(callQuery, orderedParams);
        
        // Query temp tables with naming convention
        const tempTables = [
          `temp_proc_report_stats`,
          `temp_proc_top_categories`,
          `temp_proc_${functionName}_result`
        ];
        
        const tempData: any = {};
        for (const tableName of tempTables) {
          try {
            const tempResult = await strapi.db.connection.raw(`SELECT * FROM ${tableName}`);
            if (tempResult.rows && tempResult.rows.length > 0) {
              tempData[tableName.replace('temp_proc_', '')] = tempResult.rows;
            }
          } catch (e) {
            // Table doesn't exist, skip
          }
        }
        
        if (Object.keys(tempData).length === 0) {
          return ctx.send({
            success: true,
            message: 'Procedure executed successfully',
            meta: {
              functionName,
              type: 'procedure',
              parametersUsed: parsedParams,
              note: 'Procedure executed but no standard temp tables found'
            }
          });
        }
        
        return ctx.send({
          success: true,
          data: tempData,
          meta: {
            functionName,
            type: 'procedure',
            parametersUsed: parsedParams,
            generatedAt: new Date().toISOString()
          }
        });
      }

      return ctx.send({
        success: true,
        data: result.rows,
        meta: {
          functionName,
          type: 'function',
          parametersUsed: parsedParams,
          resultCount: result.rows.length,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      strapi.log.error('Error calling database function (POST):', error);
      return ctx.internalServerError(`Failed to call function: ${error.message}`);
    }
  }
}));
