import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { DatabaseService } from '../../database/database.service';
import { TransactionRepository } from '../transaction.repository';
import { TransactionCategoryRepository } from '../transaction-category.repository';
import { CategoryRepository } from '../category.repository';
import { AccountRepository } from '../account.repository';
import { UserRepository } from '../user.repository';

describe('TransactionRepository - getTotalsByCategory', () => {
  const testDbPath = path.join(process.cwd(), 'test-data', 'transaction-repo-test.db');
  const testDir = path.dirname(testDbPath);
  let dbService: DatabaseService;
  let db: Database.Database;
  let transactionRepo: TransactionRepository;
  let transactionCategoryRepo: TransactionCategoryRepository;
  let categoryRepo: CategoryRepository;
  let accountRepo: AccountRepository;
  let userRepo: UserRepository;
  let testAccountId: string;
  let categoryGroceryId: string;
  let categoryRestaurantId: string;
  let categoryUtilitiesId: string;

  // Setup: Create database and repositories once before all tests
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

    // Initialize repositories
    userRepo = new UserRepository(db);
    accountRepo = new AccountRepository(db);
    categoryRepo = new CategoryRepository(db);
    transactionCategoryRepo = new TransactionCategoryRepository(db);
    transactionRepo = new TransactionRepository(db, transactionCategoryRepo);
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
        // Only remove directory if it's empty (or only contains our test file)
        if (files.length === 0 || (files.length === 1 && files[0] === path.basename(testDbPath))) {
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

    const utilitiesCategory = categoryRepo.create('Utilities', null, ['electric', 'water']);
    categoryUtilitiesId = utilitiesCategory.id;
  });

  describe('getTotalsByCategory', () => {
    it('should return expenses grouped by category', () => {
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

      const txn3 = transactionRepo.create(
        testAccountId,
        'hash3',
        new Date('2025-01-20'),
        new Date('2025-01-20'),
        -75, // expense
        'ILS',
        'Electric bill',
        'completed',
        null,
        JSON.stringify({})
      );

      // Attach categories and mark as main
      transactionCategoryRepo.attach(txn1.id, categoryGroceryId, false, true);
      transactionCategoryRepo.attach(txn2.id, categoryRestaurantId, false, true);
      transactionCategoryRepo.attach(txn3.id, categoryUtilitiesId, false, true);

      // Query category distribution
      const result = transactionRepo.getTotalsByCategory(
        [testAccountId],
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      // Verify results
      expect(result).toHaveLength(3);
      expect(result).toContainEqual(
        expect.objectContaining({
          category: 'Grocery',
          total: -100,
          count: 1,
        })
      );
      expect(result).toContainEqual(
        expect.objectContaining({
          category: 'Restaurant',
          total: -50,
          count: 1,
        })
      );
      expect(result).toContainEqual(
        expect.objectContaining({
          category: 'Utilities',
          total: -75,
          count: 1,
        })
      );
    });

    it('should exclude income transactions', () => {
      // Create income and expense transactions
      const expense = transactionRepo.create(
        testAccountId,
        'hash-expense',
        new Date('2025-02-10'),
        new Date('2025-02-10'),
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
        new Date('2025-02-15'),
        new Date('2025-02-15'),
        5000, // income (positive)
        'ILS',
        'Salary deposit',
        'completed',
        null,
        JSON.stringify({})
      );

      // Attach categories and mark as main
      transactionCategoryRepo.attach(expense.id, categoryGroceryId, false, true);
      transactionCategoryRepo.attach(income.id, categoryGroceryId, false, true);

      // Query category distribution
      const result = transactionRepo.getTotalsByCategory(
        [testAccountId],
        new Date('2025-02-01'),
        new Date('2025-02-28')
      );

      // Should only return the expense, not the income
      const groceryResult = result.find((r) => r.category === 'Grocery');
      expect(groceryResult).toBeDefined();
      expect(groceryResult?.total).toBe(-100); // Only the expense
      expect(groceryResult?.count).toBe(1); // Only one transaction
    });

    it('should handle transactions with multiple categories', () => {
      // Create a transaction with multiple categories
      const txn = transactionRepo.create(
        testAccountId,
        'hash-multi-cat',
        new Date('2025-03-10'),
        new Date('2025-03-10'),
        -100, // expense
        'ILS',
        'Market with restaurant area',
        'completed',
        null,
        JSON.stringify({})
      );

      // Attach multiple categories to same transaction - only first one is main
      transactionCategoryRepo.attach(txn.id, categoryGroceryId, false, true); // Main category
      transactionCategoryRepo.attach(txn.id, categoryRestaurantId, false, false); // Secondary category (not in analytics)

      // Query category distribution
      const result = transactionRepo.getTotalsByCategory(
        [testAccountId],
        new Date('2025-03-01'),
        new Date('2025-03-31')
      );

      // Only the main category should appear in analytics
      const groceryResult = result.find((r) => r.category === 'Grocery');
      const restaurantResult = result.find((r) => r.category === 'Restaurant');

      // Only main category appears in analytics
      expect(groceryResult).toBeDefined();
      expect(groceryResult?.total).toBe(-100);
      expect(groceryResult?.count).toBe(1);

      // Secondary category should NOT appear in analytics (not main)
      expect(restaurantResult).toBeUndefined();
    });

    it('should respect date range filtering', () => {
      // Create transactions in different months
      const jan = transactionRepo.create(
        testAccountId,
        'hash-jan',
        new Date('2025-01-15'),
        new Date('2025-01-15'),
        -100,
        'ILS',
        'Supermarket',
        'completed',
        null,
        JSON.stringify({})
      );

      const mar = transactionRepo.create(
        testAccountId,
        'hash-mar',
        new Date('2025-03-15'),
        new Date('2025-03-15'),
        -200,
        'ILS',
        'Supermarket',
        'completed',
        null,
        JSON.stringify({})
      );

      transactionCategoryRepo.attach(jan.id, categoryGroceryId, false, true);
      transactionCategoryRepo.attach(mar.id, categoryGroceryId, false, true);

      // Query only March
      const result = transactionRepo.getTotalsByCategory(
        [testAccountId],
        new Date('2025-03-01'),
        new Date('2025-03-31')
      );

      const groceryResult = result.find((r) => r.category === 'Grocery');
      expect(groceryResult?.total).toBe(-200); // Only March transaction
      expect(groceryResult?.count).toBe(1);
    });

    it('should return empty array when no expenses found', () => {
      // Create user and account with no transactions
      const user = userRepo.create('test-user-empty', 'password-hash');
      const emptyAccount = accountRepo.create(user.id, '99999', 'hapoalim', 'Empty Account');

      const result = transactionRepo.getTotalsByCategory(
        [emptyAccount.id],
        new Date('2025-01-01'),
        new Date('2025-12-31')
      );

      expect(result).toEqual([]);
    });

    it('should handle multiple accounts correctly', () => {
      // Create second user and account
      const user2 = userRepo.create('test-user-2', 'password-hash');
      const account2 = accountRepo.create(user2.id, '54321', 'leumi', 'Account 2');

      // Create transactions in different accounts
      const txn1 = transactionRepo.create(
        testAccountId,
        'hash-acc1',
        new Date('2025-04-10'),
        new Date('2025-04-10'),
        -100,
        'ILS',
        'Supermarket',
        'completed',
        null,
        JSON.stringify({})
      );

      const txn2 = transactionRepo.create(
        account2.id,
        'hash-acc2',
        new Date('2025-04-15'),
        new Date('2025-04-15'),
        -200,
        'ILS',
        'Restaurant',
        'completed',
        null,
        JSON.stringify({})
      );

      transactionCategoryRepo.attach(txn1.id, categoryGroceryId, false, true);
      transactionCategoryRepo.attach(txn2.id, categoryRestaurantId, false, true);

      // Query both accounts
      const result = transactionRepo.getTotalsByCategory(
        [testAccountId, account2.id],
        new Date('2025-04-01'),
        new Date('2025-04-30')
      );

      expect(result).toHaveLength(2);
      const groceryResult = result.find((r) => r.category === 'Grocery');
      const restaurantResult = result.find((r) => r.category === 'Restaurant');

      expect(groceryResult?.total).toBe(-100);
      expect(restaurantResult?.total).toBe(-200);
    });
  });
});
