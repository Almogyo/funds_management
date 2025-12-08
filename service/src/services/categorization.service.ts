import { Logger } from '../utils/logger';
import { CategoryRepository } from '../repositories/category.repository';
import { TransactionCategoryRepository } from '../repositories/transaction-category.repository';
import { Category } from '../types';

export class CategorizationService {
  private categories: Category[] = [];
  private readonly UNKNOWN_CATEGORY = 'Unknown';

  constructor(
    private logger: Logger,
    private categoryRepository: CategoryRepository,
    private transactionCategoryRepository: TransactionCategoryRepository
  ) {
    this.loadCategories();
    this.ensureUnknownCategory();
  }

  private loadCategories(): void {
    this.categories = this.categoryRepository.list();
    this.logger.info(`Loaded ${this.categories.length} categories for matching`);
  }

  public ensureUnknownCategory(): void {
    const unknownCategory = this.categoryRepository.findByName(this.UNKNOWN_CATEGORY);
    if (!unknownCategory) {
      this.logger.info(`Creating default 'Unknown' category`);
      this.categoryRepository.create(this.UNKNOWN_CATEGORY, null, []);
      this.loadCategories();
    }
  }

  /**
   * Categorize a single transaction description
   * Uses exact-match logic (case-insensitive substring matching)
   * Returns array of matching category IDs (can have multiple matches)
   */
  categorizeTransaction(description: string): string[] {
    const normalizedDescription = this.normalizeText(description);
    const matchedCategoryIds: string[] = [];

    for (const category of this.categories) {
      if (category.name === this.UNKNOWN_CATEGORY) continue;
      if (category.keywords.length === 0) continue;

      for (const keyword of category.keywords) {
        const normalizedKeyword = this.normalizeText(keyword);
        // Exact match: check if keyword appears as a word or substring in description
        if (this.exactMatch(normalizedDescription, normalizedKeyword)) {
          matchedCategoryIds.push(category.id);
          this.logger.debug(`Categorized transaction`, {
            description,
            category: category.name,
            matchedKeyword: keyword,
          });
          break; // Move to next category once we found a match
        }
      }
    }

    if (matchedCategoryIds.length === 0) {
      this.logger.debug(`No category match found for transaction`, { description });
    }

    return matchedCategoryIds;
  }

  /**
   * Exact-match logic: checks if keyword appears in description
   * Supports word boundaries and substring matching
   */
  private exactMatch(normalizedDescription: string, normalizedKeyword: string): boolean {
    // Direct substring match
    if (normalizedDescription.includes(normalizedKeyword)) {
      return true;
    }
    return false;
  }

  /**
   * Normalize text for matching: lowercase, trim spaces, keep alphanumeric + hebrew
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim();
  }

  /**
   * Re-categorize a specific transaction
   * Removes old automatic categories and applies new ones based on current rules
   */
  recategorizeTransaction(transactionId: string, description: string): string[] {
    const categoryIds = this.categorizeTransaction(description);
    this.transactionCategoryRepository.replaceAutomatic(transactionId, categoryIds);
    return categoryIds;
  }

  /**
   * Re-categorize multiple transactions in batches (async-friendly)
   * Used when categories change to update all affected transactions
   */
  async recategorizeBatch(
    transactions: Array<{ id: string; description: string }>,
    batchSize: number = 100
  ): Promise<{ processed: number; updated: number }> {
    this.logger.info(`Starting bulk re-categorization for ${transactions.length} transactions`, {
      batchSize,
    });

    let totalProcessed = 0;
    let totalUpdated = 0;

    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(transactions.length / batchSize);

      this.logger.info(
        `Processing batch ${batchNum}/${totalBatches} (${batch.length} transactions)`
      );

      const updates: Array<{ transactionId: string; categoryIds: string[] }> = [];

      for (const txn of batch) {
        const categoryIds = this.categorizeTransaction(txn.description);
        if (categoryIds.length > 0) {
          updates.push({ transactionId: txn.id, categoryIds });
          totalUpdated++;
        }
        totalProcessed++;
      }

      // Bulk update categories
      if (updates.length > 0) {
        this.transactionCategoryRepository.bulkReplaceAutomatic(updates);
      }

      // Allow event loop to process other operations (ready for async/await in production)
      await new Promise((resolve) => setImmediate(resolve));
    }

    this.logger.info(
      `Bulk re-categorization complete: ${totalUpdated}/${totalProcessed} transactions updated`,
      { totalProcessed, totalUpdated }
    );

    return { processed: totalProcessed, updated: totalUpdated };
  }

  /**
   * Re-categorize all transactions (triggered on category change)
   */
  async recategorizeAll(): Promise<{ processed: number; updated: number }> {
    const transactions = this.transactionCategoryRepository.getAllTransactionDescriptions();
    return this.recategorizeBatch(transactions);
  }

  /**
   * Get category by ID
   */
  getCategory(id: string): Category | null {
    return this.categoryRepository.findById(id);
  }

  /**
   * Get all categories
   */
  getAllCategories(): Category[] {
    return this.categories;
  }

  /**
   * Reload categories from database (call after category updates)
   */
  reloadCategories(): void {
    this.logger.info(`Reloading categories from database`);
    this.loadCategories();
  }

  /**
   * Get the Unknown category
   */
  getUnknownCategory(): string {
    return this.UNKNOWN_CATEGORY;
  }
}
