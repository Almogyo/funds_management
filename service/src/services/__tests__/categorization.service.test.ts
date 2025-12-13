import path from 'path';
import fs from 'fs';
import { DatabaseService } from '../../database/database.service';
import { CategorizationService } from '../categorization.service';
import { TransactionRepository } from '../../repositories/transaction.repository';
import { TransactionCategoryRepository } from '../../repositories/transaction-category.repository';
import { CategoryRepository } from '../../repositories/category.repository';
import { AccountRepository } from '../../repositories/account.repository';
import { UserRepository } from '../../repositories/user.repository';
import { Logger } from '../../utils/logger';

describe('CategorizationService - Category Creation/Update with Auto Main Category', () => {
  const testDbPath = path.join(process.cwd(), 'test-data', 'categorization-service-test.db');
  let dbService: DatabaseService;
  let logger: Logger;
  let categorizationService: CategorizationService;
  let transactionRepo: TransactionRepository;
  let transactionCategoryRepo: TransactionCategoryRepository;
  let categoryRepo: CategoryRepository;
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

    userRepo = new UserRepository(db);
    accountRepo = new AccountRepository(db);
    categoryRepo = new CategoryRepository(db);
    transactionCategoryRepo = new TransactionCategoryRepository(db);
    transactionRepo = new TransactionRepository(db, transactionCategoryRepo);
    categorizationService = new CategorizationService(logger, categoryRepo, transactionCategoryRepo);

    // Create test user first
    const user = userRepo.create('testuser', 'password-hash');
    testUserId = user.id;

    // Create test account
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

  describe('recategorizeTransaction with forceMainCategoryId', () => {
    it('should set forceMainCategoryId as main when it matches a categorization result', () => {
      // Create a new category with specific keywords
      const groceryCategory = categoryRepo.create('Grocery', null, ['supermarket', 'market']);
      
      // Reload categories to pick up the new one
      categorizationService.reloadCategories();

      // Create a transaction
      const txn = transactionRepo.create(
        testAccountId,
        'hash1',
        new Date('2025-01-10'),
        new Date('2025-01-10'),
        -100,
        'ILS',
        'supermarket purchase',
        'completed',
        null,
        JSON.stringify({})
      );

      // Recategorize with forceMainCategoryId - Grocery category should be marked as main
      const categoryIds = categorizationService.recategorizeTransaction(
        txn.id,
        'supermarket purchase',
        groceryCategory.id
      );

      // Verify the category was matched
      expect(categoryIds).toContain(groceryCategory.id);

      // Verify it was marked as main in the junction table
      const categories = transactionCategoryRepo.getByTransactionId(txn.id);
      expect(categories).toHaveLength(1);
      expect(categories[0].categoryId).toBe(groceryCategory.id);
      expect(categories[0].isMain).toBe(true);
    });

    it('should set first category as main when forceMainCategoryId does not match any result', () => {
      // Create two categories
      const groceryCategory = categoryRepo.create('Grocery', null, ['supermarket']);
      const restaurantCategory = categoryRepo.create('Restaurant', null, ['pizza']);

      // Reload to pick up new categories
      categorizationService.reloadCategories();

      // Create a transaction that matches Grocery
      const txn = transactionRepo.create(
        testAccountId,
        'hash2',
        new Date('2025-01-10'),
        new Date('2025-01-10'),
        -100,
        'ILS',
        'supermarket purchase',
        'completed',
        null,
        JSON.stringify({})
      );

      // Recategorize with non-matching forceMainCategoryId
      const categoryIds = categorizationService.recategorizeTransaction(
        txn.id,
        'supermarket purchase',
        restaurantCategory.id
      );

      // Verify Grocery was matched (not Restaurant)
      expect(categoryIds).toContain(groceryCategory.id);
      expect(categoryIds).not.toContain(restaurantCategory.id);

      // Verify Grocery is marked as main (first match) since forceMainCategoryId didn't match
      const categories = transactionCategoryRepo.getByTransactionId(txn.id);
      expect(categories).toHaveLength(1);
      expect(categories[0].categoryId).toBe(groceryCategory.id);
      expect(categories[0].isMain).toBe(true);
    });

    it('should handle batch recategorization with forceMainCategoryId', async () => {
      // Create a new category
      const clothingCategory = categoryRepo.create('Clothing', null, ['shirt', 'pants', 'jacket']);

      // Reload categories
      categorizationService.reloadCategories();

      // Create multiple transactions
      const txn1 = transactionRepo.create(
        testAccountId,
        'hash1',
        new Date('2025-01-10'),
        new Date('2025-01-10'),
        -50,
        'ILS',
        'bought a shirt',
        'completed',
        null,
        JSON.stringify({})
      );

      const txn2 = transactionRepo.create(
        testAccountId,
        'hash2',
        new Date('2025-01-15'),
        new Date('2025-01-15'),
        -75,
        'ILS',
        'bought pants',
        'completed',
        null,
        JSON.stringify({})
      );

      // Simulate category creation by recategorizing all with forceMainCategoryId
      const transactions = [
        { id: txn1.id, description: 'bought a shirt' },
        { id: txn2.id, description: 'bought pants' }
      ];

      const result = await categorizationService.recategorizeBatch(transactions, 10, clothingCategory.id);

      // Verify all were processed
      expect(result.processed).toBe(2);
      expect(result.updated).toBe(2);

      // Verify both transactions have Clothing as main category
      const txn1Categories = transactionCategoryRepo.getByTransactionId(txn1.id);
      const txn2Categories = transactionCategoryRepo.getByTransactionId(txn2.id);

      expect(txn1Categories).toHaveLength(1);
      expect(txn1Categories[0].categoryId).toBe(clothingCategory.id);
      expect(txn1Categories[0].isMain).toBe(true);

      expect(txn2Categories).toHaveLength(1);
      expect(txn2Categories[0].categoryId).toBe(clothingCategory.id);
      expect(txn2Categories[0].isMain).toBe(true);
    });
  });

  describe('recategorizeAll with forceMainCategoryId', () => {
    it('should set new category as main for all matching transactions', async () => {
      // Create existing category
      const groceryCategory = categoryRepo.create('Grocery', null, ['supermarket']);

      // Create transactions with existing category
      const txn1 = transactionRepo.create(
        testAccountId,
        'hash1',
        new Date('2025-01-10'),
        new Date('2025-01-10'),
        -100,
        'ILS',
        'Supermarket A',
        'completed',
        null,
        JSON.stringify({})
      );

      const txn2 = transactionRepo.create(
        testAccountId,
        'hash2',
        new Date('2025-01-15'),
        new Date('2025-01-15'),
        -50,
        'ILS',
        'Supermarket B',
        'completed',
        null,
        JSON.stringify({})
      );

      // Attach with old category as main
      transactionCategoryRepo.attach(txn1.id, groceryCategory.id, false, true);
      transactionCategoryRepo.attach(txn2.id, groceryCategory.id, false, true);

      // Create new category with better keywords
      const supermarketCategory = categoryRepo.create('Supermarket', null, ['supermarket', 'market']);
      categorizationService.reloadCategories();

      // Recategorize all with new category as forceMainCategoryId
      const result = await categorizationService.recategorizeAll(supermarketCategory.id);

      // Both should match the new Supermarket category
      expect(result.processed).toBe(2);
      expect(result.updated).toBe(2);

      // Verify new category is now main
      const txn1Categories = transactionCategoryRepo.getByTransactionId(txn1.id);
      const txn2Categories = transactionCategoryRepo.getByTransactionId(txn2.id);

      const txn1MainCategory = txn1Categories.find((c) => c.isMain);
      const txn2MainCategory = txn2Categories.find((c) => c.isMain);

      expect(txn1MainCategory?.categoryId).toBe(supermarketCategory.id);
      expect(txn2MainCategory?.categoryId).toBe(supermarketCategory.id);
    });
  });
});
