import { DatabaseService } from '../database.service';
import fs from 'fs';
import path from 'path';

describe('DatabaseService', () => {
  const testDbPath = path.join(process.cwd(), 'test-data', 'test.db');

  beforeEach(() => {
    const dir = path.dirname(testDbPath);
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  afterEach(() => {
    const dir = path.dirname(testDbPath);
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        files.forEach((file) => {
          const filePath = path.join(dir, file);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
        fs.rmdirSync(dir);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('constructor', () => {
    it('should create database file and initialize tables', () => {
      const dbService = new DatabaseService(testDbPath);

      expect(fs.existsSync(testDbPath)).toBe(true);

      const db = dbService.getDatabase();
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as Array<{ name: string }>;

      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('credentials');
      expect(tableNames).toContain('accounts');
      expect(tableNames).toContain('transactions');
      expect(tableNames).toContain('categories');
      expect(tableNames).toContain('scraper_jobs');

      dbService.close();
    });

    it('should enable WAL mode when specified', () => {
      const dbService = new DatabaseService(testDbPath, true);
      const db = dbService.getDatabase();

      const result = db.pragma('journal_mode', { simple: true });
      expect(result).toBe('wal');

      dbService.close();
    });

    it('should enable foreign keys when specified', () => {
      const dbService = new DatabaseService(testDbPath, true, true);
      const db = dbService.getDatabase();

      const result = db.pragma('foreign_keys', { simple: true });
      expect(result).toBe(1);

      dbService.close();
    });
  });

  describe('transaction methods', () => {
    it('should execute transaction successfully', () => {
      const dbService = new DatabaseService(testDbPath);
      const db = dbService.getDatabase();

      const result = dbService.transaction(() => {
        db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
          '1',
          'test',
          'hash',
          Date.now()
        );
        return 'success';
      });

      expect(result).toBe('success');

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get('1');
      expect(user).toBeDefined();

      dbService.close();
    });

    it('should rollback on error', () => {
      const dbService = new DatabaseService(testDbPath);
      const db = dbService.getDatabase();

      try {
        dbService.transaction(() => {
          db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
            '1',
            'test',
            'hash',
            Date.now()
          );
          throw new Error('Test error');
        });
      } catch {
        // Expected
      }

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get('1');
      expect(user).toBeUndefined();

      dbService.close();
    });
  });

  describe('healthCheck', () => {
    it('should return true for healthy database', () => {
      const dbService = new DatabaseService(testDbPath);

      expect(dbService.healthCheck()).toBe(true);

      dbService.close();
    });

    it('should return false after closing database', () => {
      const dbService = new DatabaseService(testDbPath);
      dbService.close();

      expect(dbService.healthCheck()).toBe(false);
    });
  });

  describe('backup', () => {
    it('should create backup of database', () => {
      const dbService = new DatabaseService(testDbPath);
      const backupDir = path.join(process.cwd(), 'test-backup');
      const backupPath = path.join(backupDir, 'backup.db');

      const db = dbService.getDatabase();
      db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
        '1',
        'test',
        'hash',
        Date.now()
      );

      dbService.backup(backupPath);

      expect(fs.existsSync(backupPath)).toBe(true);

      const backupDb = new DatabaseService(backupPath, false, false);
      const user = backupDb.getDatabase().prepare('SELECT * FROM users WHERE id = ?').get('1');
      expect(user).toBeDefined();

      backupDb.close();
      dbService.close();

      if (fs.existsSync(backupDir)) {
        const files = fs.readdirSync(backupDir);
        files.forEach((file) => {
          fs.unlinkSync(path.join(backupDir, file));
        });
        fs.rmdirSync(backupDir);
      }
    });
  });
});