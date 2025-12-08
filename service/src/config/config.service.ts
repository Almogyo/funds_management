import fs from 'fs';
import path from 'path';
import { AppConfig, AppConfigSchema } from './config.schema';
import { KeyGenerator } from '../utils/key-generator';

export class ConfigService {
  private config: AppConfig;
  private configPath: string;
  private keyGenerator: KeyGenerator;

  constructor(configPath?: string) {
    this.keyGenerator = new KeyGenerator();
    this.configPath = configPath || this.getDefaultConfigPath();
    this.config = this.loadConfig();
  }

  private getDefaultConfigPath(): string {
    return path.join(process.cwd(), 'config', 'config.json');
  }

  private loadConfig(): AppConfig {
    const config = this.loadFromFile();
    const configWithEnv = this.mergeWithEnvironment(config);
    return this.validateConfig(configWithEnv);
  }

  private loadFromFile(): Partial<AppConfig> {
    if (!fs.existsSync(this.configPath)) {
      return this.getDefaultConfig();
    }

    try {
      const fileContent = fs.readFileSync(this.configPath, 'utf-8');
      const jsonContent = this.stripJsonComments(fileContent);
      return JSON.parse(jsonContent);
    } catch (error) {
      throw new Error(`Failed to parse config file: ${(error as Error).message}`);
    }
  }

  private stripJsonComments(content: string): string {
    return content.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) =>
      g ? '' : m
    );
  }

  private mergeWithEnvironment(fileConfig: Partial<AppConfig>): Partial<AppConfig> {
    const generatedKeys = this.keyGenerator.ensureKeysExist();
    
    const merged: Partial<AppConfig> = {
      ...fileConfig,
      server: {
        ...fileConfig.server,
        port: process.env.PORT ? parseInt(process.env.PORT, 10) : fileConfig.server?.port,
        host: process.env.HOST || fileConfig.server?.host,
        env:
          (process.env.NODE_ENV as 'development' | 'production' | 'test') || fileConfig.server?.env,
      } as any,
      database: {
        ...fileConfig.database,
        path: process.env.DATABASE_PATH || fileConfig.database?.path,
      } as any,
      security: {
        ...fileConfig.security,
        jwtSecret: process.env.JWT_SECRET || fileConfig.security?.jwtSecret || generatedKeys.jwtSecret,
        jwtExpiration: process.env.JWT_EXPIRATION || fileConfig.security?.jwtExpiration,
        refreshTokenExpiration:
          process.env.REFRESH_TOKEN_EXPIRATION || fileConfig.security?.refreshTokenExpiration,
        encryptionKey: process.env.ENCRYPTION_KEY || fileConfig.security?.encryptionKey || generatedKeys.encryptionKey,
        sessionSecret: process.env.SESSION_SECRET || generatedKeys.sessionSecret,
        rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS
          ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10)
          : fileConfig.security?.rateLimitWindowMs,
        rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS
          ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10)
          : fileConfig.security?.rateLimitMaxRequests,
      } as any,
      logging: {
        ...fileConfig.logging,
        level:
          (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') ||
          fileConfig.logging?.level,
        filePath: process.env.LOG_FILE_PATH || fileConfig.logging?.filePath,
      } as any,
      scraping: {
        ...fileConfig.scraping,
        maxParallelScrapers: process.env.MAX_PARALLEL_SCRAPERS
          ? parseInt(process.env.MAX_PARALLEL_SCRAPERS, 10)
          : fileConfig.scraping?.maxParallelScrapers,
        timeout: process.env.SCRAPER_TIMEOUT
          ? parseInt(process.env.SCRAPER_TIMEOUT, 10)
          : fileConfig.scraping?.timeout,
        screenshotOnError: process.env.SCREENSHOT_ON_ERROR
          ? process.env.SCREENSHOT_ON_ERROR === 'true'
          : fileConfig.scraping?.screenshotOnError,
      } as any,
      accounts: fileConfig.accounts || [],
      categories: fileConfig.categories || [],
    };
    return merged;
  }

  private validateConfig(config: Partial<AppConfig>): AppConfig {
    try {
      return AppConfigSchema.parse(config);
    } catch (error) {
      throw new Error(`Config validation failed: ${(error as Error).message}`);
    }
  }

  private getDefaultConfig(): Partial<AppConfig> {
    return {
      server: {
        port: 3000,
        host: 'localhost',
        env: 'development',
      },
      database: {
        path: './data/funds_management.db',
        enableWAL: true,
        enableForeignKeys: true,
      },
      security: {
        jwtSecret: '',
        jwtExpiration: '24h',
        refreshTokenExpiration: '7d',
        encryptionKey: '',
        rateLimitWindowMs: 900000,
        rateLimitMaxRequests: 100,
      },
      logging: {
        level: 'info',
        filePath: './logs',
        console: true,
        file: true,
      },
      scraping: {
        daysBack: 30,
        futureMonths: 0,
        maxParallelScrapers: 2,
        timeout: 60000,
        combineInstallments: false,
        showBrowser: false,
        screenshotOnError: true,
        screenshotPath: './screenshots',
      },
      accounts: [],
      categories: [],
    };
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  public reload(): void {
    this.config = this.loadConfig();
  }

  public get server() {
    return this.config.server;
  }

  public get database() {
    return this.config.database;
  }

  public get security() {
    return this.config.security;
  }

  public get logging() {
    return this.config.logging;
  }

  public get scraping() {
    return this.config.scraping;
  }

  public get accounts() {
    return this.config.accounts;
  }

  public get categories() {
    return this.config.categories;
  }
}
