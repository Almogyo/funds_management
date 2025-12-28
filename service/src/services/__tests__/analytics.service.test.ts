import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { DatabaseService } from '../../database/database.service';
import { AnalyticsService } from '../analytics.service';
import { TransactionRepository } from '../../repositories/transaction.repository';
import { TransactionCategoryRepository } from '../../repositories/transaction-category.repository';
import { AccountRepository } from '../../repositories/account.repository';
import { Logger } from '../../utils/logger';
import { UserRepository } from '../../repositories/user.repository';

describe('AnalyticsService - Expense Trends and Profit Calculation', () => {
  const testDbPath = path.join(process.cwd(), 'test-data', 'analytics-trends-test.db');
  const testDir = path.dirname(testDbPath);
  let dbService: DatabaseService;
  let db: Database.Database;
  let logger: Logger;
  let analyticsService: AnalyticsService;
  let transactionRepo: TransactionRepository;
  let accountRepo: AccountRepository;
  let userRepo: UserRepository;
  let testAccountId: string;
  let testUserId: string;

  // Setup: Create database and services once before all tests
  beforeAll(() => {
    // Ensure test directory exists once before all tests
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Verify directory was created successfully
    if (!fs.existsSync(testDir)) {
      throw new Error(`Failed to create test directory: ${testDir}`);
    }
    
    // Clean up any leftover db file from previous runs
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (error) {
        // Ignore errors - file might be locked or not exist
      }
    }

    // Create fresh database instance (DatabaseService will also ensure directory exists)
    dbService = new DatabaseService(testDbPath);
    db = dbService.getDatabase();

    // Initialize logger
    logger = new Logger({
      level: 'error',
      filePath: testDir,
      console: false,
      file: false,
    });

    // Initialize repositories
    accountRepo = new AccountRepository(db);
    const transactionCategoryRepo = new TransactionCategoryRepository(db);
    transactionRepo = new TransactionRepository(db, transactionCategoryRepo);
    userRepo = new UserRepository(db);
    analyticsService = new AnalyticsService(logger, transactionRepo, accountRepo);
  });

  // Cleanup: Close database and remove test files after all tests
  afterAll(() => {
    if (db) {
      db.close();
    }
    
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
        // Only remove directory if it's empty (we already deleted the test file above)
        if (files.length === 0) {
          fs.rmdirSync(testDir);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  // Before each test: Clear all data and recreate test fixtures
  beforeEach(() => {
    // Clear all tables (cascade deletes will handle relationships)
    db.exec('DELETE FROM transaction_categories');
    db.exec('DELETE FROM transactions');
    db.exec('DELETE FROM categories');
    db.exec('DELETE FROM accounts');
    db.exec('DELETE FROM credentials');
    db.exec('DELETE FROM users');

    // Recreate test fixtures for each test
    const user = userRepo.create('test-user', 'hashedpassword');
    testUserId = user.id;

    // Create test account linked to user
    const account = accountRepo.create(testUserId, '12345', 'hapoalim', 'Test Account');
    testAccountId = account.id;
  });

  describe('calculateExpenseTrends - Basic Functionality', () => {
    it('should calculate trends with correct net amount field', () => {
      // September: income 100, expenses 2100
      transactionRepo.create(
        testAccountId,
        'hash-sep-income',
        new Date('2025-09-15'),
        new Date('2025-09-15'),
        100,
        'ILS',
        'Income',
        'completed',
        null,
        JSON.stringify({})
      );

      transactionRepo.create(
        testAccountId,
        'hash-sep-expense',
        new Date('2025-09-20'),
        new Date('2025-09-20'),
        -2100,
        'ILS',
        'Expense',
        'completed',
        null,
        JSON.stringify({})
      );

      const trends = analyticsService.calculateExpenseTrends(
        [testAccountId],
        {
          startDate: new Date('2025-09-01'),
          endDate: new Date('2025-09-30'),
        },
        'monthly'
      );

      expect(trends).toHaveLength(1);
      const trend = trends[0];
      expect(trend.period).toBe('2025-09');
      expect(trend.totalIncome).toBe(100);
      expect(trend.totalExpenses).toBe(2100);
      expect(trend.netAmount).toBe(-2000); // 100 - 2100
      expect(trend.profitTrend).toBe(-2000); // First period, so cumulative = net
    });

    it('should include transactionCount in trends', () => {
      // Create multiple transactions
      transactionRepo.create(testAccountId, 'h1', new Date('2025-09-15'), new Date('2025-09-15'), 100, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h2', new Date('2025-09-20'), new Date('2025-09-20'), -50, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h3', new Date('2025-09-25'), new Date('2025-09-25'), -30, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      const trends = analyticsService.calculateExpenseTrends(
        [testAccountId],
        {
          startDate: new Date('2025-09-01'),
          endDate: new Date('2025-09-30'),
        },
        'monthly'
      );

      expect(trends).toHaveLength(1);
      expect(trends[0].transactionCount).toBe(3);
    });
  });

  describe('calculateExpenseTrends - Cumulative Profit Calculation', () => {
    it('should calculate cumulative profit trend correctly with ordered periods', () => {
      // January: income 1000, expenses 500 = profit 500
      transactionRepo.create(testAccountId, 'h1', new Date('2025-01-15'), new Date('2025-01-15'), 1000, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h2', new Date('2025-01-20'), new Date('2025-01-20'), -500, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      // February: income 1000, expenses 400 = profit 600
      transactionRepo.create(testAccountId, 'h3', new Date('2025-02-15'), new Date('2025-02-15'), 1000, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h4', new Date('2025-02-20'), new Date('2025-02-20'), -400, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      // March: income 1000, expenses 300 = profit 700
      transactionRepo.create(testAccountId, 'h5', new Date('2025-03-15'), new Date('2025-03-15'), 1000, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h6', new Date('2025-03-20'), new Date('2025-03-20'), -300, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      const trends = analyticsService.calculateExpenseTrends(
        [testAccountId],
        {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-03-31'),
        },
        'monthly'
      );

      expect(trends).toHaveLength(3);
      expect(trends[0].period).toBe('2025-01');
      expect(trends[0].netAmount).toBe(500);
      expect(trends[0].profitTrend).toBe(500); // First period

      expect(trends[1].period).toBe('2025-02');
      expect(trends[1].netAmount).toBe(600);
      expect(trends[1].profitTrend).toBe(1100); // 500 + 600

      expect(trends[2].period).toBe('2025-03');
      expect(trends[2].netAmount).toBe(700);
      expect(trends[2].profitTrend).toBe(1800); // 500 + 600 + 700
    });

    it('should handle negative cumulative profit', () => {
      // January: loss 100
      transactionRepo.create(testAccountId, 'h1', new Date('2025-01-20'), new Date('2025-01-20'), -100, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      // February: loss 50
      transactionRepo.create(testAccountId, 'h2', new Date('2025-02-20'), new Date('2025-02-20'), -50, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      const trends = analyticsService.calculateExpenseTrends(
        [testAccountId],
        {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-02-28'),
        },
        'monthly'
      );

      expect(trends).toHaveLength(2);
      expect(trends[0].profitTrend).toBe(-100);
      expect(trends[1].profitTrend).toBe(-150); // -100 + -50
    });

    it('should show increasing profit trend over multiple periods', () => {
      // Create transactions across 3 months with increasing profit
      transactionRepo.create(testAccountId, 'h1', new Date('2025-01-15'), new Date('2025-01-15'), 1000, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h2', new Date('2025-01-20'), new Date('2025-01-20'), -800, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      transactionRepo.create(testAccountId, 'h3', new Date('2025-02-15'), new Date('2025-02-15'), 1000, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h4', new Date('2025-02-20'), new Date('2025-02-20'), -700, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      transactionRepo.create(testAccountId, 'h5', new Date('2025-03-15'), new Date('2025-03-15'), 1000, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h6', new Date('2025-03-20'), new Date('2025-03-20'), -600, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      const trends = analyticsService.calculateExpenseTrends(
        [testAccountId],
        {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-03-31'),
        },
        'monthly'
      );

      expect(trends).toHaveLength(3);
      expect(trends[0].profitTrend).toBe(200); // 1000 - 800
      expect(trends[1].profitTrend).toBe(500); // 200 + (1000 - 700)
      expect(trends[2].profitTrend).toBe(900); // 500 + (1000 - 600)
    });

    it('should correctly handle user scenario: Sep, Oct, Nov with losses and profits', () => {
      // September: loss 2000
      transactionRepo.create(testAccountId, 'h1', new Date('2025-09-15'), new Date('2025-09-15'), 100, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h2', new Date('2025-09-20'), new Date('2025-09-20'), -2100, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      // October: profit 20
      transactionRepo.create(testAccountId, 'h3', new Date('2025-10-15'), new Date('2025-10-15'), 1000, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h4', new Date('2025-10-20'), new Date('2025-10-20'), -980, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      // November: profit 110
      transactionRepo.create(testAccountId, 'h5', new Date('2025-11-15'), new Date('2025-11-15'), 1000, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h6', new Date('2025-11-20'), new Date('2025-11-20'), -890, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      const trends = analyticsService.calculateExpenseTrends(
        [testAccountId],
        {
          startDate: new Date('2025-09-01'),
          endDate: new Date('2025-11-30'),
        },
        'monthly'
      );

      expect(trends).toHaveLength(3);
      expect(trends[0].profitTrend).toBe(-2000); // Sep: 100 - 2100
      expect(trends[1].profitTrend).toBe(-1980); // Oct: -2000 + (1000 - 980)
      expect(trends[2].profitTrend).toBe(-1870); // Nov: -1980 + (1000 - 890)
    });
  });

  describe('calculateExpenseTrends - Data Integrity', () => {
    it('should return empty array when no transactions found', () => {
      const trends = analyticsService.calculateExpenseTrends(
        [testAccountId],
        {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31'),
        },
        'monthly'
      );

      expect(trends).toEqual([]);
    });

    it('should handle transactions from multiple accounts aggregated', () => {
      // Create second account
      const user2 = userRepo.create('test-user-2', 'hashedpassword');
      const account2 = accountRepo.create(user2.id, '54321', 'leumi', 'Account 2');

      // Transactions in account 1
      transactionRepo.create(testAccountId, 'h1', new Date('2025-09-15'), new Date('2025-09-15'), 500, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h2', new Date('2025-09-20'), new Date('2025-09-20'), -200, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      // Transactions in account 2
      transactionRepo.create(account2.id, 'h3', new Date('2025-09-15'), new Date('2025-09-15'), 500, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(account2.id, 'h4', new Date('2025-09-20'), new Date('2025-09-20'), -300, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      const trends = analyticsService.calculateExpenseTrends(
        [testAccountId, account2.id],
        {
          startDate: new Date('2025-09-01'),
          endDate: new Date('2025-09-30'),
        },
        'monthly'
      );

      expect(trends).toHaveLength(1);
      expect(trends[0].totalIncome).toBe(1000); // 500 + 500
      expect(trends[0].totalExpenses).toBe(500); // 200 + 300
      expect(trends[0].netAmount).toBe(500); // 1000 - 500
    });

    it('should only include completed transactions', () => {
      // Create completed and pending transactions
      transactionRepo.create(testAccountId, 'h1', new Date('2025-09-15'), new Date('2025-09-15'), 1000, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h2', new Date('2025-09-20'), new Date('2025-09-20'), -500, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h3', new Date('2025-09-25'), new Date('2025-09-25'), -200, 'ILS', 'Exp', 'pending', null, JSON.stringify({}));

      const trends = analyticsService.calculateExpenseTrends(
        [testAccountId],
        {
          startDate: new Date('2025-09-01'),
          endDate: new Date('2025-09-30'),
        },
        'monthly'
      );

      expect(trends).toHaveLength(1);
      expect(trends[0].totalIncome).toBe(1000);
      expect(trends[0].totalExpenses).toBe(500); // Only completed expense
      expect(trends[0].netAmount).toBe(500); // 1000 - 500
    });
  });

  describe('calculateExpenseTrends - Summary Metrics', () => {
    it('should allow calculation of total savings (last period cumulative profit)', () => {
      // Create 3 months of data
      transactionRepo.create(testAccountId, 'h1', new Date('2025-01-15'), new Date('2025-01-15'), 1000, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h2', new Date('2025-01-20'), new Date('2025-01-20'), -500, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      transactionRepo.create(testAccountId, 'h3', new Date('2025-02-15'), new Date('2025-02-15'), 1000, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h4', new Date('2025-02-20'), new Date('2025-02-20'), -400, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      transactionRepo.create(testAccountId, 'h5', new Date('2025-03-15'), new Date('2025-03-15'), 1000, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h6', new Date('2025-03-20'), new Date('2025-03-20'), -300, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      const trends = analyticsService.calculateExpenseTrends(
        [testAccountId],
        {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-03-31'),
        },
        'monthly'
      );

      const totalSavings = trends[trends.length - 1].profitTrend;
      expect(totalSavings).toBe(1800); // 500 + 600 + 700
    });

    it('should allow calculation of average net amount per period', () => {
      // Create 3 months of data
      transactionRepo.create(testAccountId, 'h1', new Date('2025-01-15'), new Date('2025-01-15'), 1000, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h2', new Date('2025-01-20'), new Date('2025-01-20'), -500, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      transactionRepo.create(testAccountId, 'h3', new Date('2025-02-15'), new Date('2025-02-15'), 1000, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h4', new Date('2025-02-20'), new Date('2025-02-20'), -400, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      transactionRepo.create(testAccountId, 'h5', new Date('2025-03-15'), new Date('2025-03-15'), 1000, 'ILS', 'Inc', 'completed', null, JSON.stringify({}));
      transactionRepo.create(testAccountId, 'h6', new Date('2025-03-20'), new Date('2025-03-20'), -300, 'ILS', 'Exp', 'completed', null, JSON.stringify({}));

      const trends = analyticsService.calculateExpenseTrends(
        [testAccountId],
        {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-03-31'),
        },
        'monthly'
      );

      const averageNetAmount = trends.reduce((sum, t) => sum + t.netAmount, 0) / trends.length;
      expect(averageNetAmount).toBe(600); // (500 + 600 + 700) / 3
    });
  });
});
