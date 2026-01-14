/**
 * Database Function/Procedure Routes
 * 
 * Routes để gọi database functions và procedures
 * Không liên quan đến bất kỳ content-type nào
 */

export default {
  routes: [
    // GET Method - Call database function/procedure với query parameters
    {
      method: 'GET',
      path: '/db-functions/call',
      handler: 'db-function.callFunction',
      config: {
        auth: false, // Public access - có thể thay đổi nếu cần authentication
        description: 'Call database function or procedure (GET method) - Named Parameters',
        tag: {
          plugin: 'api',
          name: 'Database Functions'
        }
      }
    },

    // POST Method - Call database function/procedure với JSON body
    {
      method: 'POST',
      path: '/db-functions/call',
      handler: 'db-function.callFunctionPost',
      config: {
        auth: false, // Public access - có thể thay đổi nếu cần authentication
        description: 'Call database function or procedure (POST method) - Named Parameters',
        tag: {
          plugin: 'api',
          name: 'Database Functions'
        }
      }
    }
  ]
};
