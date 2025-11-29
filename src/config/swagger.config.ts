import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Israeli Funds Management API',
      version: '1.0.0',
      description: 'API for managing Israeli bank accounts, scraping transactions, and analyzing finances',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        SessionAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Session-ID',
          description: 'Session ID obtained from login',
        },
      },
      schemas: {
        CompanyId: {
          type: 'string',
          enum: [
            'hapoalim',
            'leumi',
            'discount',
            'mizrahi',
            'union',
            'massad',
            'visaCal',
            'max',
            'isracard',
            'amex',
          ],
          description: 'Financial institution identifier - includes both banks and credit card companies',
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
            createdAt: { type: 'number' },
            lastLogin: { type: 'number', nullable: true },
          },
        },
        Account: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            companyId: { type: 'string' },
            alias: { type: 'string' },
            active: { type: 'boolean' },
            lastScrapedAt: { type: 'number', nullable: true },
            createdAt: { type: 'number' },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            accountId: { type: 'string', format: 'uuid' },
            txnHash: { type: 'string' },
            date: { type: 'number' },
            processedDate: { type: 'number' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['completed', 'pending'] },
            installmentNumber: { type: 'number', nullable: true },
            installmentTotal: { type: 'number', nullable: true },
            createdAt: { type: 'number' },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            parentCategory: { type: 'string', nullable: true },
            keywords: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'number' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Accounts', description: 'Bank account management' },
      { name: 'Transactions', description: 'Transaction queries and updates' },
      { name: 'Analytics', description: 'Financial analytics and statistics' },
      { name: 'Scraping', description: 'Bank scraping operations' },
    ],
  },
  apis: ['./src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);