/**
 * Database Function/Procedure Caller Controller
 * 
 * Generic controller để gọi bất kỳ function hoặc procedure nào trong PostgreSQL database
 * Hỗ trợ named parameters và tự động detect function/procedure metadata
 */

/**
 * Helper: Get function/procedure metadata from PostgreSQL catalog
 * Truy vấn pg_catalog để lấy thông tin về function/procedure
 * 
 * @param functionName - Tên của function hoặc procedure
 * @returns Metadata object hoặc null nếu không tìm thấy
 */
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

/**
 * Helper: Convert parameter type theo PostgreSQL data types
 * 
 * @param value - Giá trị cần convert
 * @param type - PostgreSQL data type
 * @returns Converted value
 */
function convertParamType(value: any, type: string) {
  if (value === null || value === undefined) return null;
  
  const typeStr = String(type).toLowerCase();
  
  // Integer types
  if (typeStr.includes('int') || typeStr.includes('serial')) {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
  
  // Numeric/Decimal types
  if (typeStr.includes('numeric') || typeStr.includes('decimal') || typeStr.includes('real') || typeStr.includes('double')) {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
  
  // Boolean types
  if (typeStr.includes('bool')) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return Boolean(value);
  }
  
  // Date/Time types - giữ nguyên
  if (typeStr.includes('date') || typeStr.includes('time')) {
    return value;
  }
  
  // Default: convert to string
  return String(value);
}

/**
 * Helper: Map named parameters to positional parameters
 * PostgreSQL functions/procedures yêu cầu positional parameters
 * 
 * @param namedParams - Object chứa named parameters
 * @param parameterMetadata - Metadata của các parameters
 * @returns Array of positional parameters
 */
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

export default {
  /**
   * CALL DATABASE FUNCTION/PROCEDURE - GET Method
   * 
   * Endpoint: GET /api/db-functions/call
   * Query params:
   *   - functionName: Tên của function/procedure (required)
   *   - params: JSON string chứa named parameters (optional)
   * 
   * Example:
   *   GET /api/db-functions/call?functionName=get_category_report
   *   GET /api/db-functions/call?functionName=get_category_report_proc&params={"limit_num":50,"is_active_only":true}
   */
  async callFunction(ctx) {
    try {
      const { functionName, params } = ctx.query;

      // Validate required parameter
      if (!functionName) {
        return ctx.badRequest('Missing required parameter: functionName');
      }

      // Parse params nếu có
      let parsedParams = {};
      if (params) {
        try {
          parsedParams = typeof params === 'string' ? JSON.parse(params) : params;
        } catch (e) {
          return ctx.badRequest('Invalid params format. Must be valid JSON.');
        }
      }

      // Lấy metadata của function/procedure
      const functionMetadata = await getFunctionMetadata(String(functionName));
      
      if (!functionMetadata) {
        return ctx.notFound(`Function or Procedure '${functionName}' not found in database`);
      }

      // Map named params thành positional params
      const orderedParams = mapNamedToPositionalParams(parsedParams, functionMetadata.parameters);
      
      let result;
      
      if (functionMetadata.isFunction) {
        // FUNCTION: SELECT * FROM function_name(params)
        const placeholders = orderedParams.map(() => '?').join(', ');
        const query = `SELECT * FROM ${functionName}(${placeholders})`;
        result = await strapi.db.connection.raw(query, orderedParams);
        
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
      } else if (functionMetadata.isProcedure) {
        // PROCEDURE: CALL procedure_name(params)
        const placeholders = orderedParams.map(() => '?').join(', ');
        const callQuery = `CALL ${functionName}(${placeholders})`;
        
        // Execute procedure
        await strapi.db.connection.raw(callQuery, orderedParams);
        
        // Query temporary tables với naming convention
        // Convention: temp_proc_<table_name> hoặc temp_proc_<procedure_name>_result
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
              tempData[tableName] = tempResult.rows;
            }
          } catch (e) {
            // Table không tồn tại - skip
          }
        }
        
        // Nếu không tìm thấy temp tables nào
        if (Object.keys(tempData).length === 0) {
          return ctx.send({
            success: true,
            message: `Procedure '${functionName}' executed successfully, but no temporary tables found`,
            data: {},
            meta: {
              functionName,
              type: 'procedure',
              parametersUsed: parsedParams,
              note: 'Procedure may not return data or uses different temp table naming',
              generatedAt: new Date().toISOString()
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

    } catch (error) {
      strapi.log.error('Error calling database function:', error);
      return ctx.internalServerError(`Failed to call function: ${error.message}`);
    }
  },

  /**
   * CALL DATABASE FUNCTION/PROCEDURE - POST Method
   * 
   * Endpoint: POST /api/db-functions/call
   * Body (JSON):
   *   - functionName: Tên của function/procedure (required)
   *   - params: Object chứa named parameters (optional)
   * 
   * Example:
   *   POST /api/db-functions/call
   *   Body: {
   *     "functionName": "get_category_report_proc",
   *     "params": {
   *       "limit_num": 50,
   *       "is_active_only": true,
   *       "sort_by": "order"
   *     }
   *   }
   */
  async callFunctionPost(ctx) {
    try {
      const { functionName, params } = ctx.request.body;

      // Validate required parameter
      if (!functionName) {
        return ctx.badRequest('Missing required parameter: functionName in request body');
      }

      // Parse params nếu có
      let parsedParams = {};
      if (params) {
        parsedParams = typeof params === 'string' ? JSON.parse(params) : params;
      }

      // Lấy metadata của function/procedure
      const functionMetadata = await getFunctionMetadata(String(functionName));
      
      if (!functionMetadata) {
        return ctx.notFound(`Function or Procedure '${functionName}' not found in database`);
      }

      // Map named params thành positional params
      const orderedParams = mapNamedToPositionalParams(parsedParams, functionMetadata.parameters);
      
      let result;
      
      if (functionMetadata.isFunction) {
        // FUNCTION: SELECT * FROM function_name(params)
        const placeholders = orderedParams.map(() => '?').join(', ');
        const query = `SELECT * FROM ${functionName}(${placeholders})`;
        result = await strapi.db.connection.raw(query, orderedParams);
        
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
      } else if (functionMetadata.isProcedure) {
        // PROCEDURE: CALL procedure_name(params)
        const placeholders = orderedParams.map(() => '?').join(', ');
        const callQuery = `CALL ${functionName}(${placeholders})`;
        
        // Execute procedure
        await strapi.db.connection.raw(callQuery, orderedParams);
        
        // Query temporary tables với naming convention
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
              tempData[tableName] = tempResult.rows;
            }
          } catch (e) {
            // Table không tồn tại - skip
          }
        }
        
        // Nếu không tìm thấy temp tables nào
        if (Object.keys(tempData).length === 0) {
          return ctx.send({
            success: true,
            message: `Procedure '${functionName}' executed successfully, but no temporary tables found`,
            data: {},
            meta: {
              functionName,
              type: 'procedure',
              parametersUsed: parsedParams,
              note: 'Procedure may not return data or uses different temp table naming',
              generatedAt: new Date().toISOString()
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

    } catch (error) {
      strapi.log.error('Error calling database function (POST):', error);
      return ctx.internalServerError(`Failed to call function: ${error.message}`);
    }
  }
};
