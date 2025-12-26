export default () => ({
  documentation: {
    enabled: true,
    config: {
      openapi: '3.0.0',
      info: {
        version: '1.0.0',
        title: 'Strapi Test 2 API Documentation',
        description: 'API Documentation for Strapi Test 2 project with Category, Course, and Product management',
        termsOfService: 'YOUR_TERMS_OF_SERVICE_URL',
        contact: {
          name: 'API Support',
          email: 'support@example.com',
          url: 'https://example.com/support'
        },
        license: {
          name: 'Apache 2.0',
          url: 'https://www.apache.org/licenses/LICENSE-2.0.html'
        },
      },
      'x-strapi-config': {
        // Tùy chọn hiển thị plugins
        plugins: ['users-permissions', 'upload'],
        path: '/documentation',
      },
      servers: [
        {
          url: 'http://localhost:1337/api',
          description: 'Development server',
        },
        {
          url: 'https://your-production-url.com/api',
          description: 'Production server',
        },
      ],
      externalDocs: {
        description: 'Find out more',
        url: 'https://docs.strapi.io/developer-docs/latest/getting-started/introduction.html'
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    },
  },
});
