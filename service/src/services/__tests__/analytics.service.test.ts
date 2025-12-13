import path from 'path';
import fs from 'fs';
import { DatabaseService } from '../../database/database.service';
import { AnalyticsService } from '../analytics.service';
import { TransactionRepository } from '../../repositories/transaction.repository';
import { TransactionCategoryRepository } from '../../repositories/transaction-category.repository';
import { AccountRepository } from '../../repositories/account.repository';
import { Logger } from '../../utils/logger';
import { UserRepository } from '../../repositories/user.repository';

describe('AnalyticsService - Expense Trends and Profit Calculation', () => {
  const testDbPath = path.join(process.cwd(), 'test-data', 'analytics-trends-test.db');
  let dbService: DatabaseService;
  let logger: Logger;
  let analyticsService: AnalyticsService;
  let transactionRepo: TransactionRepository;
  let accountRepo: AccountRepository;
  let userRepo: UserRepository;
  let testAccountId: string;
  let testUserId: string;

  beforeEach(() => {
    const dir = path.dirname(testDbPath);
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    dbService = new DatabaseService(testDbPath);
    const db = dbService.getDatabase();

    logger = new Logger({
      level: 'error',
      filePath: path.join(process.cwd(), 'test-data'),
      console: false,
      file: false,
    });

    accountRepo = new AccountRepository(db);
    const transactionCategoryRepo = new TransactionCategoryRepository(db);
    transactionRepo = new TransactionRepository(db, transactionCategoryRepo);
    userRepo = new UserRepository(db);
    analyticsService = new AnalyticsService(logger, transactionRepo, accountRepo);

    // Create test user first
    const user = userRepo.create('test-user', 'hashedpassword');
    testUserId = user.id;

    // Create test account linked to user
    const account = accountRepo.create(testUserId, '12345', 'hapoalim', 'Test Account');
    testAccountId = account.id;
  });

  afterEach(() => {
    dbService.close();
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
      expect(trend.netAmount).toBe(-2000); // income - expenses = 100 - 2100
      expect(trend.profitTrend).toBe(-2000); // First period, cumulative = -2000
    });

    it('should include transactionCount in trends', () => {
      // Create 3 transactions
      transactionRepo.create(
        testAccountId,
        'hash-1',
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
        'hash-2',
        new Date('2025-09-20'),
        new Date('2025-09-20'),
        -50,
        'ILS',
        'Expense 1',
        'completed',
        null,
        JSON.stringify({})
      );

      transactionRepo.create(
        testAccountId,
        'hash-3',
        new Date('2025-09-25'),
        new Date('2025-09-25'),
        -30,
        'ILS',
        'Expense 2',
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

      expect(trends[0].transactionCount).toBe(3);
    });
  });

  describe('calculateExpenseTrends - Cumulative Profit Calculation', () => {
    it('should calculate cumulative profit trend correctly with ordered periods', () => {
      // November: income 100, expenses 90 -> profit 10
      transactionRepo.create(
        testAccountId,
        'hash-nov-income',
        new Date('2025-11-15'),
        new Date('2025-11-15'),
        100,
        'ILS',
        'Salary',
        'completed',
        null,
        JSON.stringify({})
      );

      transactionRepo.create(
        testAccountId,
        'hash-nov-expense',
        new Date('2025-11-20'),
        new Date('2025-11-20'),
        -90,
        'ILS',
        'Groceries',
        'completed',
        null,
        JSON.stringify({})
      );

      // December: income 200, expenses 100 -> profit 100
      transactionRepo.create(
        testAccountId,
        'hash-dec-income',
        new Date('2025-12-15'),
        new Date('2025-12-15'),
        200,
        'ILS',
        'Salary',
        'completed',
        null,
        JSON.stringify({})
      );

      transactionRepo.create(
        testAccountId,
        'hash-dec-expense',
        new Date('2025-12-20'),
        new Date('2025-12-20'),
        -100,
        'ILS',
        'Utilities',
        'completed',
        null,
        JSON.stringify({})
      );

      const trends = analyticsService.calculateExpenseTrends(
        [testAccountId],
        {
          startDate: new Date('2025-11-01'),
          endDate: new Date('2025-12-31'),
        },
        'monthly'
      );

      // Verify periods are sorted
      expect(trends[0].period).toBe('2025-11');
      expect(trends[1].period).toBe('2025-12');

      // Verify November
      expect(trends[0].totalIncome).toBe(100);
      expect(trends[0].totalExpenses).toBe(90);
      expect(trends[0].netAmount).toBe(10);
      expect(trends[0].profitTrend).toBe(10); // Cumulative: 0 + 10 = 10

      // Verify December
      expect(trends[1].totalIncome).toBe(200);
      expect(trends[1].totalExpenses).toBe(100);
      expect(trends[1].netAmount).toBe(100);
      expect(trends[1].profitTrend).toBe(110); // Cumulative: 10 + 100 = 110
    });

    it('should handle negative cumulative profit', () => {
      // January: income 100, expenses 200 -> loss of 100
      transactionRepo.create(
        testAccountId,
        'hash-jan-income',
        new Date('2025-01-15'),
        new Date('2025-01-15'),
        100,
        'ILS',
        'Salary',
        'completed',
        null,
        JSON.stringify({})
      );

      transactionRepo.create(
        testAccountId,
        'hash-jan-expense',
        new Date('2025-01-20'),
        new Date('2025-01-20'),
        -200,
        'ILS',
        'Big expense',
        'completed',
        null,
        JSON.stringify({})
      );

      // February: income 100, expenses 50 -> profit 50
      transactionRepo.create(
        testAccountId,
        'hash-feb-income',
        new Date('2025-02-15'),
        new Date('2025-02-15'),
        100,
        'ILS',
        'Salary',
        'completed',
        null,
        JSON.stringify({})
      );

      transactionRepo.create(
        testAccountId,
        'hash-feb-expense',
        new Date('2025-02-20'),
        new Date('2025-02-20'),
        -50,
        'ILS',
        'Groceries',
        'completed',
        null,
        JSON.stringify({})
      );

      const trends = analyticsService.calculateExpenseTrends(
        [testAccountId],
        {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-02-28'),
        },
        'monthly'
      );

      // January: cumulative = -100
      expect(trends[0].period).toBe('2025-01');
      expect(trends[0].profitTrend).toBe(-100);

      // February: cumulative = -100 + 50 = -50
      expect(trends[1].period).toBe('2025-02');
      expect(trends[1].profitTrend).toBe(-50);
    });

    it('should show increasing profit trend over multiple periods', () => {
      // Month 1: 1000 income - 500 expense = 500 profit
      transactionRepo.create(
        testAccountId,
        'hash-m1-income',
        new Date('2025-01-15'),
        new Date('2025-01-15'),
        1000,
        'ILS',
        'Salary',
        'completed',
        null,
        JSON.stringify({})
      );
      transactionRepo.create(
        testAccountId,
        'hash-m1-expense',
        new Date('2025-01-20'),
        new Date('2025-01-20'),
        -500,
        'ILS',
        'Expenses',
        'completed',
        null,
        JSON.stringify({})
      );

      // Month 2: 1000 income - 400 expense = 600 profit
      transactionRepo.create(
        testAccountId,
        'hash-m2-income',
        new Date('2025-02-15'),
        new Date('2025-02-15'),
        1000,
        'ILS',
        'Salary',
        'completed',
        null,
        JSON.stringify({})
      );
      transactionRepo.create(
        testAccountId,
        'hash-m2-expense',
        new Date('2025-02-20'),
        new Date('2025-02-20'),
        -400,
        'ILS',
        'Expenses',
        'completed',
        null,
        JSON.stringify({})
      );

      // Month 3: 1000 income - 300 expense = 700 profit
      transactionRepo.create(
        testAccountId,
        'hash-m3-income',
        new Date('2025-03-15'),
        new Date('2025-03-15'),
        1000,
        'ILS',
        'Salary',
        'completed',
        null,
        JSON.stringify({})
      );
      transactionRepo.create(
        testAccountId,
        'hash-m3-expense',
        new Date('2025-03-20'),
        new Date('2025-03-20'),
        -300,
        'ILS',
        'Expenses',
        'completed',
        null,
        JSON.stringify({})
      );

      const trends = analyticsService.calculateExpenseTrends(
        [testAccountId],
        {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-03-31'),
        },
        'monthly'
      );

      expect(trends).toHaveLength(3);

      // Verify profit trend increases each month
      expect(trends[0].profitTrend).toBe(500); // 0 + 500
      expect(trends[1].profitTrend).toBe(1100); // 500 + 600
      expect(trends[2].profitTrend).toBe(1800); // 1100 + 700

      // Verify trend line is ascending
      expect(trends[1].profitTrend).toBeGreaterThan(trends[0].profitTrend);
      expect(trends[2].profitTrend).toBeGreaterThan(trends[1].profitTrend);
    });

    it('should correctly handle user scenario: Sep, Oct, Nov with losses and profits', () => {
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
        'Expenses',
        'completed',
        null,
        JSON.stringify({})
      );

      // October: income 36930.07, expenses 26316.97
      transactionRepo.create(
        testAccountId,
        'hash-oct-income',
        new Date('2025-10-15'),
        new Date('2025-10-15'),
        36930.07,
        'ILS',
        'Income',
        'completed',
        null,
        JSON.stringify({})
      );
      transactionRepo.create(
        testAccountId,
        'hash-oct-expense',
        new Date('2025-10-20'),
        new Date('2025-10-20'),
        -26316.97,
        'ILS',
        'Expenses',
        'completed',
        null,
        JSON.stringify({})
      );

      // November: income 49619.32, expenses 47495.43
      transactionRepo.create(
        testAccountId,
        'hash-nov-income',
        new Date('2025-11-15'),
        new Date('2025-11-15'),
        49619.32,
        'ILS',
        'Income',
        'completed',
        null,
        JSON.stringify({})
      );
      transactionRepo.create(
        testAccountId,
        'hash-nov-expense',
        new Date('2025-11-20'),
        new Date('2025-11-20'),
        -47495.43,
        'ILS',
        'Expenses',
        'completed',
        null,
        JSON.stringify({})
      );

      const trends = analyticsService.calculateExpenseTrends(
        [testAccountId],
        {
          startDate: new Date('2025-09-01'),
          endDate: new Date('2025-11-30'),
        },
        'monthly'
      );

      expect(trends).toHaveLength(3);

      // September: profit = 100 - 2100 = -2000
      expect(trends[0].period).toBe('2025-09');
      expect(trends[0].netAmount).toBe(-2000);
      expect(trends[0].profitTrend).toBe(-2000);

      // October: profit = 36930.07 - 26316.97 = 10613.1
      // Cumulative = -2000 + 10613.1 = 8613.1
      expect(trends[1].period).toBe('2025-10');
      expect(trends[1].netAmount).toBeCloseTo(10613.1, 1);
      expect(trends[1].profitTrend).toBeCloseTo(8613.1, 1);

      // November: profit = 49619.32 - 47495.43 = 2123.89
      // Cumulative = 8613.1 + 2123.89 = 10736.99
      expect(trends[2].period).toBe('2025-11');
      expect(trends[2].netAmount).toBeCloseTo(2123.89, 1);
      expect(trends[2].profitTrend).toBeCloseTo(10736.99, 1);

      // Verify cumulative trend increases despite individual variations
      expect(trends[2].profitTrend).toBeGreaterThan(trends[1].profitTrend);
      expect(trends[1].profitTrend).toBeGreaterThan(trends[0].profitTrend);
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
      // Create another user and account
      const user2 = userRepo.create('test-user-2', 'hashedpassword2');
      const account2 = accountRepo.create(user2.id, '67890', 'poalim', 'Second Account');

      // Transactions in first account
      transactionRepo.create(
        testAccountId,
        'hash-1',
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
        'hash-2',
        new Date('2025-09-20'),
        new Date('2025-09-20'),
        -50,
        'ILS',
        'Expense',
        'completed',
        null,
        JSON.stringify({})
      );

      // Transactions in second account
      transactionRepo.create(
        account2.id,
        'hash-3',
        new Date('2025-09-15'),
        new Date('2025-09-15'),
        200,
        'ILS',
        'Income',
        'completed',
        null,
        JSON.stringify({})
      );

      transactionRepo.create(
        account2.id,
        'hash-4',
        new Date('2025-09-20'),
        new Date('2025-09-20'),
        -100,
        'ILS',
        'Expense',
        'completed',
        null,
        JSON.stringify({})
      );

      const trends = analyticsService.calculateExpenseTrends(
        [testAccountId, account2.id],
        {
          startDate: new Date('2025-09-01'),
          endDate: new Date('2025-09-30'),
        },
        'monthly'
      );

      expect(trends).toHaveLength(1);
      // Total income: 100 + 200 = 300
      // Total expenses: 50 + 100 = 150
      // Net: 300 - 150 = 150
      expect(trends[0].totalIncome).toBe(300);
      expect(trends[0].totalExpenses).toBe(150);
      expect(trends[0].netAmount).toBe(150);
      expect(trends[0].profitTrend).toBe(150);
    });

    it('should only include completed transactions', () => {
      // Create completed transaction
      transactionRepo.create(
        testAccountId,
        'hash-1',
        new Date('2025-09-15'),
        new Date('2025-09-15'),
        100,
        'ILS',
        'Income',
        'completed',
        null,
        JSON.stringify({})
      );

      // Create pending transaction (should not be included)
      transactionRepo.create(
        testAccountId,
        'hash-2',
        new Date('2025-09-20'),
        new Date('2025-09-20'),
        -1000,
        'ILS',
        'Expense',
        'pending',
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
      expect(trends[0].totalIncome).toBe(100);
      expect(trends[0].totalExpenses).toBe(0); // Pending transaction not included
      expect(trends[0].netAmount).toBe(100);
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

