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

describe('CategorizationService', () => {
  const testDbPath = path.join(process.cwd(), `test-categorization-${Date.now()}.db`);
  let dbService: DatabaseService;
  let logger: Logger;
  let categorizationService: CategorizationService;
  let categoryRepo: CategoryRepository;
  let testAccountId: string;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    dbService = new DatabaseService(testDbPath, false, true);
    const db = dbService.getDatabase();

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    categoryRepo = new CategoryRepository(db);
    const transactionCategoryRepo = new TransactionCategoryRepository(db);
    const transactionRepo = new TransactionRepository(db, transactionCategoryRepo);
    categorizationService = new CategorizationService(categoryRepo, transactionRepo, undefined, logger);

    // Create test user first
    const userRepo = new UserRepository(db);
    const user = userRepo.create('testuser', 'password-hash');
    const testUserId = user.id;

    // Create test account
    const accountRepo = new AccountRepository(db);
    const account = accountRepo.create(testUserId, '12345', 'hapoalim', 'Test Account');
    testAccountId = account.id;
  });

  afterEach(() => {
    dbService.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('categorizeTransaction (sync mode)', () => {
    it('should categorize transaction description using simple matching', () => {
      const result = categorizationService.categorizeTransaction('Supermarket shopping at Shoferssal');

      expect(Array.isArray(result)).toBe(true);
      expect((result)).toBeGreaterThan(0);
    });

    it('should handle empty description gracefully', () => {
      const result = categorizationService.categorizeTransaction('');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('categorizeTransaction (async mode)', () => {
    it('should handle transaction object with fuzzy matching', async () => {
      const transaction = {
        id: 'txn-1',
        accountId: 'acc-1',
        date: new Date(),
        amount: -100,
        description: 'Supermarket purchase',
        vendor: 'SHOFERSSAL',
        transactionType: 'debit',
        source: 'bank' as any,
        status: 'completed' as any,
        enrichmentData: {},
        rawDescription: 'SHOFERSSAL STORE 001',
      } as any;

      const result = await categorizationService.categorizeTransaction(transaction);

      expect(result).toHaveProperty('mainCategoryId');
      expect(result).toHaveProperty('allCategoryIds');
      expect(result).toHaveProperty('decision');
      expect(Array.isArray(result.allCategoryIds)).toBe(true);
    });
  });

  describe('recategorizeAll', () => {
    it('should process all transactions without error', async () => {
      const result = await categorizationService.recategorizeAll();

      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('updated');
      expect(typeof result.processed).toBe('number');
      expect(typeof result.updated).toBe('number');
    });
  });
});

