import { z } from 'zod';

export const AccountConfigSchema = z.object({
  accountName: z.string().min(1, 'Account name is required'),
  companyId: z.string().min(1, 'Company ID is required'),
  credentials: z.record(z.string(), z.string()),
  active: z.boolean().default(true),
});

export const ScrapingOptionsSchema = z.object({
  daysBack: z.number().int().positive().default(30),
  futureMonths: z.number().int().min(0).max(6).default(0),
  maxParallelScrapers: z.number().int().min(1).max(10).default(2),
  timeout: z.number().int().positive().default(60000),
  combineInstallments: z.boolean().default(false),
  showBrowser: z.boolean().default(false),
  screenshotOnError: z.boolean().default(true),
  screenshotPath: z.string().default('./screenshots'),
});

export const CategoryMappingSchema = z.object({
  name: z.string().min(1),
  parentCategory: z.string().optional(),
  keywords: z.array(z.string()).default([]),
});

export const ServerConfigSchema = z.object({
  port: z.number().int().positive().default(3000),
  host: z.string().default('localhost'),
  env: z.enum(['development', 'production', 'test']).default('development'),
});

export const DatabaseConfigSchema = z.object({
  path: z.string().default('./data/funds_management.db'),
  enableWAL: z.boolean().default(true),
  enableForeignKeys: z.boolean().default(true),
});

export const SecurityConfigSchema = z.object({
  jwtSecret: z.string().min(32, 'JWT secret must be at least 32 characters'),
  jwtExpiration: z.string().default('24h'),
  refreshTokenExpiration: z.string().default('7d'),
  encryptionKey: z.string().min(32, 'Encryption key must be at least 32 characters'),
  sessionSecret: z.string().min(32, 'Session secret must be at least 32 characters').optional(),
  rateLimitWindowMs: z.number().int().positive().default(900000),
  rateLimitMaxRequests: z.number().int().positive().default(100),
});

export const LoggingConfigSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  filePath: z.string().default('./logs'),
  console: z.boolean().default(true),
  file: z.boolean().default(true),
});

export const AppConfigSchema = z.object({
  server: ServerConfigSchema,
  database: DatabaseConfigSchema,
  security: SecurityConfigSchema,
  logging: LoggingConfigSchema,
  scraping: ScrapingOptionsSchema,
  accounts: z.array(AccountConfigSchema).default([]),
  categories: z.array(CategoryMappingSchema).default([]),
});

export type AccountConfig = z.infer<typeof AccountConfigSchema>;
export type ScrapingOptions = z.infer<typeof ScrapingOptionsSchema>;
export type CategoryMapping = z.infer<typeof CategoryMappingSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;