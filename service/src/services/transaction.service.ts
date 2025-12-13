import { Transaction, InstallmentInfo } from '../types';
import { TransactionRepository } from '../repositories/transaction.repository';
import { TransactionCategoryRepository } from '../repositories/transaction-category.repository';
import { CategoryRepository } from '../repositories/category.repository';
import { Logger } from '../utils/logger';

/**
 * TransactionService handles all business logic related to transactions,
 * serving as the single point of access for transaction data operations.
 * Controllers delegate to this service, which in turn uses repositories.
 */
export class TransactionService {
  constructor(
    private logger: Logger,
    private transactionRepository: TransactionRepository,
    private transactionCategoryRepository: TransactionCategoryRepository,
    private categoryRepository: CategoryRepository
  ) {}

  /**
   * Create a new transaction with optional main category
   */
  createTransaction(
    accountId: string,
    txnHash: string,
    date: Date,
    processedDate: Date,
    amount: number,
    currency: string,
    description: string,
    status: 'completed' | 'pending',
    installmentInfo: InstallmentInfo | null,
    rawJson: string,
    mainCategoryId?: string | null
  ): Transaction {
    return this.transactionRepository.create(
      accountId,
      txnHash,
      date,
      processedDate,
      amount,
      currency,
      description,
      status,
      installmentInfo,
      rawJson,
      mainCategoryId
    );
  }

  /**
   * Get a transaction by ID
   */
  getTransactionById(id: string): Transaction | null {
    return this.transactionRepository.findById(id);
  }

  /**
   * Attach categories to a transaction and optionally set main category
   */
  attachCategories(
    transactionId: string,
    categoryIds: string[],
    options?: {
      isManual?: boolean;
      markFirstAsMain?: boolean;
    }
  ): void {
    const isManual = options?.isManual ?? false;
    const markFirstAsMain = options?.markFirstAsMain ?? true;

    // Attach categories
    for (let i = 0; i < categoryIds.length; i++) {
      const categoryId = categoryIds[i];
      const isMain = markFirstAsMain && i === 0;

      this.transactionCategoryRepository.attach(transactionId, categoryId, isManual, isMain);

      // Set main category ID on transaction if this is the main category
      if (isMain) {
        this.transactionRepository.setMainCategoryId(transactionId, categoryId);
      }
    }

    // If no categories matched, attach Unknown category as main
    if (categoryIds.length === 0) {
      const unknownCategory = this.categoryRepository.findByName('Unknown');
      if (unknownCategory) {
        this.transactionCategoryRepository.attach(transactionId, unknownCategory.id, false, true);
        this.transactionRepository.setMainCategoryId(transactionId, unknownCategory.id);
      }
    }
  }

  /**
   * Set the main category for a transaction
   */
  setMainCategory(transactionId: string, categoryId: string): void {
    // Verify category exists
    const category = this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    // Set as main in junction table
    this.transactionCategoryRepository.setAsMain(transactionId, categoryId);

    // Set main category ID in transactions table
    this.transactionRepository.setMainCategoryId(transactionId, categoryId);

    this.logger.info(`Set main category for transaction ${transactionId} to ${category.name}`);
  }

  /**
   * Get all transactions with their descriptions (for re-categorization)
   */
  getAllTransactionDescriptions(): Array<{ id: string; description: string }> {
    return this.transactionRepository.getAllTransactionDescriptions();
  }
}
