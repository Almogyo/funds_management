import { ConfigService } from '../config.service';
import fs from 'fs';
import path from 'path';

describe('ConfigService', () => {
  const testConfigDir = path.join(process.cwd(), 'test-config');
  const testConfigPath = path.join(testConfigDir, 'config.json');

  beforeEach(() => {
    if (!fs.existsSync(testConfigDir)) {
      fs.mkdirSync(testConfigDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
    if (fs.existsSync(testConfigDir)) {
      fs.rmdirSync(testConfigDir);
    }
  });

  describe('constructor', () => {
    it('should load default config when file does not exist', () => {
      process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long-for-testing';
      process.env.ENCRYPTION_KEY = 'test-encryption-key-min-32-chars-long-for-testing';
      
      const configService = new ConfigService(testConfigPath);
      const config = configService.getConfig();

      expect(config.server.port).toBe(3000);
      expect(config.server.host).toBe('localhost');
      expect(config.scraping.maxParallelScrapers).toBe(2);
      
      delete process.env.JWT_SECRET;
      delete process.env.ENCRYPTION_KEY;
    });

    it('should load config from file', () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;
      
      const testConfig = {
        server: { port: 4000, host: '0.0.0.0', env: 'production' },
        security: {
          jwtSecret: 'test-jwt-secret-min-32-chars-long-for-testing',
          encryptionKey: 'test-encryption-key-min-32-chars-long-for-testing',
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configService = new ConfigService(testConfigPath);
      const config = configService.getConfig();

      expect(config.server.port).toBe(4000);
      expect(config.server.host).toBe('0.0.0.0');
      expect(config.server.env).toBe('production');
      
      if (originalEnv) process.env.NODE_ENV = originalEnv;
    });

    it('should handle JSONC comments', () => {
      const testConfig = `{
  // This is a comment
  "server": {
    "port": 5000, // Port comment
    "host": "localhost",
    "env": "development"
  },
  /* Multi-line
     comment */
  "security": {
    "jwtSecret": "test-jwt-secret-min-32-chars-long-for-testing",
    "encryptionKey": "test-encryption-key-min-32-chars-long-for-testing"
  }
}`;

      fs.writeFileSync(testConfigPath, testConfig);

      const configService = new ConfigService(testConfigPath);
      const config = configService.getConfig();

      expect(config.server.port).toBe(5000);
    });
  });

  describe('environment variable override', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should override config with environment variables', () => {
      process.env.PORT = '8080';
      process.env.HOST = '127.0.0.1';
      process.env.LOG_LEVEL = 'debug';
      process.env.JWT_SECRET = 'env-jwt-secret-min-32-chars-long-for-testing-purposes';
      process.env.ENCRYPTION_KEY = 'env-encryption-key-min-32-chars-long-for-testing-purposes';

      const testConfig = {
        server: { port: 3000, host: 'localhost', env: 'development' },
        security: {
          jwtSecret: 'test-jwt-secret-min-32-chars-long-for-testing',
          encryptionKey: 'test-encryption-key-min-32-chars-long-for-testing',
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configService = new ConfigService(testConfigPath);
      const config = configService.getConfig();

      expect(config.server.port).toBe(8080);
      expect(config.server.host).toBe('127.0.0.1');
      expect(config.logging.level).toBe('debug');
      expect(config.security.jwtSecret).toBe('env-jwt-secret-min-32-chars-long-for-testing-purposes');
      expect(config.security.encryptionKey).toBe('env-encryption-key-min-32-chars-long-for-testing-purposes');
    });
  });

  describe('validation', () => {
    it('should throw error for invalid JWT secret length', () => {
      const testConfig = {
        security: {
          jwtSecret: 'short',
          encryptionKey: 'test-encryption-key-min-32-chars-long-for-testing',
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      expect(() => new ConfigService(testConfigPath)).toThrow('Config validation failed');
    });

    it('should throw error for invalid encryption key length', () => {
      const testConfig = {
        security: {
          jwtSecret: 'test-jwt-secret-min-32-chars-long-for-testing',
          encryptionKey: 'short',
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      expect(() => new ConfigService(testConfigPath)).toThrow('Config validation failed');
    });
  });

  describe('getters', () => {
    it('should provide config section getters', () => {
      process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long-for-testing';
      process.env.ENCRYPTION_KEY = 'test-encryption-key-min-32-chars-long-for-testing';
      
      const configService = new ConfigService(testConfigPath);

      expect(configService.server).toBeDefined();
      expect(configService.database).toBeDefined();
      expect(configService.security).toBeDefined();
      expect(configService.logging).toBeDefined();
      expect(configService.scraping).toBeDefined();
      expect(configService.accounts).toBeDefined();
      expect(configService.categories).toBeDefined();
      
      delete process.env.JWT_SECRET;
      delete process.env.ENCRYPTION_KEY;
    });
  });

  describe('reload', () => {
    it('should reload config from file', () => {
      const testConfig1 = {
        server: { port: 3000, host: 'localhost', env: 'development' },
        security: {
          jwtSecret: 'test-jwt-secret-min-32-chars-long-for-testing',
          encryptionKey: 'test-encryption-key-min-32-chars-long-for-testing',
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig1, null, 2));

      const configService = new ConfigService(testConfigPath);
      expect(configService.server.port).toBe(3000);

      const testConfig2 = {
        server: { port: 4000, host: 'localhost', env: 'development' },
        security: {
          jwtSecret: 'test-jwt-secret-min-32-chars-long-for-testing',
          encryptionKey: 'test-encryption-key-min-32-chars-long-for-testing',
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig2, null, 2));

      configService.reload();
      expect(configService.server.port).toBe(4000);
    });
  });
});