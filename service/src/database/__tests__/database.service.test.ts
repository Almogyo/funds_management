import { DatabaseService } from '../database.service';
import fs from 'fs';
import path from 'path';

describe('DatabaseService', () => {
  const testDbPath = path.join(process.cwd(), 'test-data', 'test.db');
  const testDir = path.dirname(testDbPath);

  // Setup: Create test directory once before all tests
  beforeAll(() => {
    // Ensure test directory exists once before all tests
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Clean up any leftover db file from previous runs
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (error) {
        // Ignore errors - file might be locked or not exist
      }
    }
  });

  // Cleanup: Remove test database file and directory after all tests
  afterAll(() => {
    // Clean up test database file
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    // Clean up test directory if it exists and is empty
    if (fs.existsSync(testDir)) {
      try {
        const files = fs.readdirSync(testDir);
        // Only remove directory if it's empty (or only contains our test file)
        if (files.length === 0 || (files.length === 1 && files[0] === path.basename(testDbPath))) {
          fs.rmdirSync(testDir);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  // Before each test: Ensure clean state (delete database file if exists)
  beforeEach(() => {
    // Remove existing database file to ensure fresh start for each test
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (error) {
        // Ignore errors - file might be locked
      }
    }
  });

  // After each test: Clean up any open database connections
  afterEach(() => {
    // Database files are cleaned up in beforeEach for next test
    // Individual tests handle closing their own DatabaseService instances
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
    it('should create backup of database', async () => {
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

      // Ensure directory exists for backup
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Use better-sqlite3 backup method properly
      const backupResult = await dbService.backup(backupPath);
      // BackupMetadata has totalPages and remainingPages properties
      const success = backupResult.totalPages > 0;

      expect(fs.existsSync(backupPath) || success).toBe(true);

      dbService.close();

      // Clean up backup directory
      if (fs.existsSync(backupDir)) {
        try {
          const files = fs.readdirSync(backupDir);
          files.forEach((file) => {
            fs.unlinkSync(path.join(backupDir, file));
          });
          fs.rmdirSync(backupDir);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });
  });
});
