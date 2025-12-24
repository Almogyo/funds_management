import path from 'path';
import fs from 'fs';
import { DatabaseService } from '../../database/database.service';
import { TransactionRepository } from '../../repositories/transaction.repository';
import { TransactionCategoryRepository } from '../../repositories/transaction-category.repository';
import { CategoryRepository } from '../../repositories/category.repository';
import { AccountRepository } from '../../repositories/account.repository';
import { UserRepository } from '../../repositories/user.repository';
import { AnalyticsService } from '../../services/analytics.service';
import { Logger } from '../../utils/logger';

describe('AnalyticsController - Category Distribution (Pie Chart)', () => {
  const testDbPath = path.join(process.cwd(), 'test-data', 'analytics-controller-test.db');
  let dbService: DatabaseService;
  let transactionRepo: TransactionRepository;
  let transactionCategoryRepo: TransactionCategoryRepository;
  let categoryRepo: CategoryRepository;
  let accountRepo: AccountRepository;
  let analyticsService: AnalyticsService;
  let logger: Logger;
  let testAccountId: string;
  let categoryGroceryId: string;
  let categoryRestaurantId: string;

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

    accountRepo = new AccountRepository(db);
    categoryRepo = new CategoryRepository(db);
    transactionCategoryRepo = new TransactionCategoryRepository(db);
    transactionRepo = new TransactionRepository(db, transactionCategoryRepo);
    logger = new Logger({
      level: 'error',
      filePath: path.join(process.cwd(), 'test-data'),
      console: false,
      file: false,
    });
    analyticsService = new AnalyticsService(logger, transactionRepo, accountRepo);

    // Create test user first
    const userRepo = new UserRepository(db);
    const user = userRepo.create('testuser', 'password-hash');
    const testUserId = user.id;

    // Create test account
    const account = accountRepo.create(testUserId, '12345', 'hapoalim', 'Test Account');
    testAccountId = account.id;

    // Create test categories
    const groceryCategory = categoryRepo.create('Grocery', null, ['supermarket', 'market']);
    categoryGroceryId = groceryCategory.id;

    const restaurantCategory = categoryRepo.create('Restaurant', null, ['pizza', 'burger']);
    categoryRestaurantId = restaurantCategory.id;
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

  describe('getCategoryDistribution', () => {
    it('should return expenses grouped by category from junction table with is_main=1 filter', () => {
      // Create transactions
      const txn1 = transactionRepo.create(
        testAccountId,
        'hash1',
        new Date('2025-01-10'),
        new Date('2025-01-10'),
        -100, // expense
        'ILS',
        'Supermarket purchase',
        'completed',
        null,
        JSON.stringify({})
      );

      const txn2 = transactionRepo.create(
        testAccountId,
        'hash2',
        new Date('2025-01-15'),
        new Date('2025-01-15'),
        -50, // expense
        'ILS',
        'Pizza restaurant',
        'completed',
        null,
        JSON.stringify({})
      );

      // Attach categories: mark first as main, second as non-main (shouldn't affect result)
      transactionCategoryRepo.attach(txn1.id, categoryGroceryId, false, true);
      transactionCategoryRepo.attach(txn1.id, categoryRestaurantId, false, false); // Non-main category
      transactionCategoryRepo.attach(txn2.id, categoryRestaurantId, false, true);

      // Query category distribution via TransactionRepository
      const result = transactionRepo.getTotalsByCategory(
        [testAccountId],
        new Date('2025-01-01'),
        new Date('2025-01-31 23:59:59.999')
      );

      // Verify results
      expect(result).toHaveLength(2);
      // Should only count Grocery once (as main) and Restaurant once (as main)
      expect(result).toContainEqual(
        expect.objectContaining({
          category: 'Grocery',
          total: -100,
        })
      );
      expect(result).toContainEqual(
        expect.objectContaining({
          category: 'Restaurant',
          total: -50,
        })
      );
    });

    it('should only count main categories, excluding non-main duplicate categories', () => {
      // Create a transaction with multiple categories attached
      const txn = transactionRepo.create(
        testAccountId,
        'hash-multi',
        new Date('2025-02-10'),
        new Date('2025-02-10'),
        -100, // expense
        'ILS',
        'Supermarket and restaurant combo',
        'completed',
        null,
        JSON.stringify({})
      );

      // Attach both categories but mark only Grocery as main
      transactionCategoryRepo.attach(txn.id, categoryGroceryId, false, true); // Main
      transactionCategoryRepo.attach(txn.id, categoryRestaurantId, false, false); // Not main

      // Query category distribution
      const result = transactionRepo.getTotalsByCategory(
        [testAccountId],
        new Date('2025-02-01'),
        new Date('2025-02-28 23:59:59.999')
      );

      // Should only show Grocery once (as main), not counting Restaurant as duplicate
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        category: 'Grocery',
        total: -100,
      });
    });

    it('should handle transactions with no categories (Unknown category)', () => {
      // Create Unknown category if not exists
      let unknownCategory = categoryRepo.findByName('Unknown');
      if (!unknownCategory) {
        unknownCategory = categoryRepo.create('Unknown', null, []);
      }

      // Create a transaction with no matched categories
      const txn = transactionRepo.create(
        testAccountId,
        'hash-unknown',
        new Date('2025-03-10'),
        new Date('2025-03-10'),
        -75, // expense
        'ILS',
        'Unknown transaction',
        'completed',
        null,
        JSON.stringify({})
      );

      // Attach Unknown category as main
      transactionCategoryRepo.attach(txn.id, unknownCategory.id, false, true);

      // Query category distribution
      const result = transactionRepo.getTotalsByCategory(
        [testAccountId],
        new Date('2025-03-01'),
        new Date('2025-03-31 23:59:59.999')
      );

      // Should include Unknown category
      const unknownResult = result.find((r) => r.category === 'Unknown');
      expect(unknownResult).toBeDefined();
      expect(unknownResult?.total).toBe(-75);
    });

    it('should exclude income transactions from pie chart', () => {
      // Create income and expense transactions
      const expense = transactionRepo.create(
        testAccountId,
        'hash-expense',
        new Date('2025-04-10'),
        new Date('2025-04-10'),
        -100, // expense
        'ILS',
        'Supermarket purchase',
        'completed',
        null,
        JSON.stringify({})
      );

      const income = transactionRepo.create(
        testAccountId,
        'hash-income',
        new Date('2025-04-15'),
        new Date('2025-04-15'),
        5000, // income (positive)
        'ILS',
        'Salary deposit',
        'completed',
        null,
        JSON.stringify({})
      );

      // Attach categories to both
      transactionCategoryRepo.attach(expense.id, categoryGroceryId, false, true);
      transactionCategoryRepo.attach(income.id, categoryGroceryId, false, true);

      // Query category distribution
      const result = transactionRepo.getTotalsByCategory(
        [testAccountId],
        new Date('2025-04-01'),
        new Date('2025-04-30 23:59:59.999')
      );

      // Should only include the expense, not the income
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        category: 'Grocery',
        total: -100, // Only the expense
      });
    });

    it('should respect date range with inclusive end date', () => {
      // Create transactions on different dates
      const txn1 = transactionRepo.create(
        testAccountId,
        'hash1',
        new Date('2025-05-01'),
        new Date('2025-05-01'),
        -50,
        'ILS',
        'Early transaction',
        'completed',
        null,
        JSON.stringify({})
      );

      const txn2 = transactionRepo.create(
        testAccountId,
        'hash2',
        new Date('2025-05-31 23:59:59'),
        new Date('2025-05-31 23:59:59'),
        -100,
        'ILS',
        'Late transaction',
        'completed',
        null,
        JSON.stringify({})
      );

      // Attach categories
      transactionCategoryRepo.attach(txn1.id, categoryGroceryId, false, true);
      transactionCategoryRepo.attach(txn2.id, categoryRestaurantId, false, true);

      // Query with full month range using inclusive end date
      const result = transactionRepo.getTotalsByCategory(
        [testAccountId],
        new Date('2025-05-01'),
        new Date('2025-05-31 23:59:59.999')
      );

      // Should include both transactions (end date should be inclusive)
      expect(result).toHaveLength(2);
      const totalAmount = result.reduce((sum: number, r: any) => sum + r.total, 0);
      expect(totalAmount).toBe(-150);
    });
  });
});

