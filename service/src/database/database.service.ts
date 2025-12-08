import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string, enableWAL = true, enableForeignKeys = true) {
    this.ensureDirectoryExists(dbPath);
    this.db = new Database(dbPath);

    if (enableWAL) {
      this.db.pragma('journal_mode = WAL');
    }

    if (enableForeignKeys) {
      this.db.pragma('foreign_keys = ON');
    }

    this.initialize();
  }

  private ensureDirectoryExists(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private initialize(): void {
    this.createTables();
    this.runMigrations();
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_login INTEGER,
        UNIQUE(username)
      );

      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        account_name TEXT NOT NULL,
        company_id TEXT NOT NULL,
        encrypted_data TEXT NOT NULL,
        iv TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, account_name)
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        account_number TEXT NOT NULL,
        company_id TEXT NOT NULL,
        alias TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        txn_hash TEXT NOT NULL,
        date INTEGER NOT NULL,
        processed_date INTEGER NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'ILS',
        description TEXT NOT NULL,
        category TEXT,
        status TEXT NOT NULL CHECK(status IN ('completed', 'pending')),
        installment_number INTEGER,
        installment_total INTEGER,
        raw_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        UNIQUE(account_id, txn_hash)
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        parent_category TEXT,
        keywords_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transaction_categories (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        is_manual INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
        UNIQUE(transaction_id, category_id)
      );

      CREATE TABLE IF NOT EXISTS scraper_jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed')),
        started_at INTEGER,
        completed_at INTEGER,
        accounts_to_scrape TEXT NOT NULL,
        results_json TEXT,
        error TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON credentials(user_id);
      CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
      CREATE INDEX IF NOT EXISTS idx_transaction_categories_transaction ON transaction_categories(transaction_id);
      CREATE INDEX IF NOT EXISTS idx_transaction_categories_category ON transaction_categories(category_id);
      CREATE INDEX IF NOT EXISTS idx_scraper_jobs_user_id ON scraper_jobs(user_id);
      CREATE INDEX IF NOT EXISTS idx_scraper_jobs_status ON scraper_jobs(status);
    `);
  }

  public getDatabase(): Database.Database {
    return this.db;
  }

  public close(): void {
    this.db.close();
  }

  public beginTransaction(): void {
    this.db.prepare('BEGIN').run();
  }

  public commit(): void {
    this.db.prepare('COMMIT').run();
  }

  public rollback(): void {
    this.db.prepare('ROLLBACK').run();
  }

  public transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  public vacuum(): void {
    this.db.exec('VACUUM');
  }

  public backup(backupPath: string): void {
    this.ensureDirectoryExists(backupPath);
    this.db.backup(backupPath);
  }

  private runMigrations(): void {
    const accountColumns = this.db.pragma("table_info('accounts')") as any[];
    const hasAccountType = accountColumns.some((col) => col.name === 'account_type');
    const hasLastScrapedAt = accountColumns.some((col) => col.name === 'last_scraped_at');

    if (!hasAccountType) {
      this.db.exec(`
        ALTER TABLE accounts ADD COLUMN account_type TEXT DEFAULT 'bank';
        
        UPDATE accounts SET account_type = 'credit' 
        WHERE company_id IN ('visaCal', 'max', 'isracard', 'amex');
        
        UPDATE accounts SET account_type = 'bank' 
        WHERE company_id NOT IN ('visaCal', 'max', 'isracard', 'amex');
      `);
    }

    if (!hasLastScrapedAt) {
      this.db.exec(`
        ALTER TABLE accounts ADD COLUMN last_scraped_at INTEGER;
      `);
    }

    // Add is_main column to transaction_categories table for supporting main category concept
    const transactionCategoryColumns = this.db.pragma("table_info('transaction_categories')") as any[];
    const hasIsMain = transactionCategoryColumns.some((col) => col.name === 'is_main');

    if (!hasIsMain) {
      this.db.exec(`
        ALTER TABLE transaction_categories ADD COLUMN is_main INTEGER NOT NULL DEFAULT 0;
      `);
    }
  }

  public healthCheck(): boolean {
    try {
      const result = this.db.prepare('SELECT 1 as health').get() as { health: number };
      return result.health === 1;
    } catch {
      return false;
    }
  }
}
