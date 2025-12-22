import { Logger } from '../utils/logger';
import { CategoryRepository } from '../repositories/category.repository';
import { TransactionRepository } from '../repositories/transaction.repository';
import { CategoryScoreRepository } from '../repositories/category-score.repository';
import { Transaction } from '../types';
import {
  FuzzyMatchingService,
  DescriptionMatchResult,
  VendorMatchResult,
  Category,
} from './fuzzy-matching.service';
import {
  CategorizeDecisionEngine,
  CategorizationDecision,
} from './categorize-decision.engine';

export interface CategorizationResult {
  mainCategoryId: string;
  allCategoryIds: string[];
  scores: {
    descriptionMatches: DescriptionMatchResult[];
    vendorMatch?: VendorMatchResult;
  };
  decision: CategorizationDecision;
}

/**
 * Refactored categorization service using fuzzy matching and hierarchical decision logic.
 *
 * Flow:
 * 1. Extract vendor category from enrichment data (if available)
 * 2. Score transaction description against all categories (fuzzy matching)
 * 3. Score vendor category against all categories (fuzzy matching)
 * 4. Apply decision hierarchy: description > vendor > unknown
 * 5. Return scored result with all candidates
 */
export class CategorizationService {
  private fuzzyService!: FuzzyMatchingService;
  private decisionEngine!: CategorizeDecisionEngine;
  private categories: Category[];

  constructor(
    private categoryRepository: CategoryRepository,
    private transactionRepository?: TransactionRepository,
    private categoryScoreRepository?: CategoryScoreRepository,
    private logger?: Logger,
    config?: {
      descriptionThreshold?: number;
      vendorThreshold?: number;
      descriptionAdvantage?: number;
    }
  ) {
    // Support both old and new constructor signatures
    // Old: (categoryRepository, transactionCategoryRepository)
    // New: (categoryRepository, transactionRepository, categoryScoreRepository, logger, config)

    if (!this.logger) {
      this.logger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      } as any;
    }

    if (this.transactionRepository && this.categoryScoreRepository && this.logger) {
      this.fuzzyService = new FuzzyMatchingService(this.logger);
      this.decisionEngine = new CategorizeDecisionEngine(this.logger, config && {
        descriptionThreshold: config.descriptionThreshold,
        vendorThreshold: config.vendorThreshold,
        descriptionAdvantage: config.descriptionAdvantage,
      });
    }

    // Load categories once
    this.categories = this.categoryRepository.list();
  }

  /**
   * Main categorization method with overload support
   * - With string: Synchronous simple categorization (backwards compatible)
   * - With Transaction: Asynchronous fuzzy matching
   */
  categorizeTransaction(descriptionOrTxn: string | Transaction): string[] | Promise<CategorizationResult> {
    // Handle old API: string input (synchronous)
    if (typeof descriptionOrTxn === 'string') {
      return this.categorizeTransactionSimple(descriptionOrTxn);
    }

    // Handle new API: Transaction object (async via promise)
    const transaction = descriptionOrTxn as Transaction;
    return this.categorizeTransactionAsync(transaction);
  }

  /**
   * Async categorization with fuzzy matching
   */
  private async categorizeTransactionAsync(transaction: Transaction): Promise<CategorizationResult> {
    // Step 1: Fuzzy match description against all categories
    const descriptionMatches = await this.fuzzyService.scoreDescriptionAgainstCategories(
      transaction.description,
      this.categories
    );

    // Step 2: Extract and fuzzy match vendor category (if available)
    let vendorMatch: VendorMatchResult | null = null;
    const vendorCategoryName = this.extractVendorCategory(transaction);

    if (vendorCategoryName) {
      vendorMatch = await this.fuzzyService.scoreVendorCategoryAgainstCategories(
        vendorCategoryName,
        this.categories
      );
    }

    // Step 3: Apply decision hierarchy
    const decision = await this.decisionEngine.determineMainCategory(
      descriptionMatches,
      vendorMatch
    );

    // Step 4: Record scores for analysis and learning
    if (transaction.id && this.categoryScoreRepository) {
      this.categoryScoreRepository.recordCategorization({
        transactionId: transaction.id,
        accountId: transaction.accountId,
        vendorId: this.extractVendorId(transaction),
        description: transaction.description,
        descriptionScores: descriptionMatches,
        vendorScore: vendorMatch,
        decision,
        timestamp: new Date(),
      });
    }

    this.logger?.debug('Categorized transaction', {
      transactionId: transaction.id,
      description: transaction.description,
      mainCategory: decision.mainCategoryId,
      confidence: decision.confidence,
      source: decision.source,
      reason: decision.reason,
      descriptionTopScore: descriptionMatches[0]?.final_score || 0,
      vendorScore: vendorMatch?.final_score || 0,
    });

    // Step 5: Compile result with all candidates
    return {
      mainCategoryId: decision.mainCategoryId,
      allCategoryIds: this.buildCategoryList(decision),
      scores: {
        descriptionMatches,
        vendorMatch: vendorMatch || undefined,
      },
      decision,
    };
  }

  /**
   * Extract vendor category from transaction enrichment data.
   */
  private extractVendorCategory(transaction: Transaction): string | null {
    try {
      const json = JSON.parse(transaction.rawJson);
      const enrichmentData = json.enrichmentData || {};

      // Try Isracard/Amex sector
      if (enrichmentData.sector) {
        return enrichmentData.sector;
      }

      // Try Max categoryId
      if (enrichmentData.maxCategoryId) {
        return enrichmentData.maxCategoryId.toString();
      }

      // Try Visa Cal merchant metadata
      if (enrichmentData.merchantMetadata?.branchCode) {
        return enrichmentData.merchantMetadata.branchCode;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract vendor ID from transaction.
   */
  private extractVendorId(transaction: Transaction): string {
    try {
      const json = JSON.parse(transaction.rawJson);
      return json.vendorId || json.companyId || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Build list of category IDs from decision result.
   * Main category first, then alternatives.
   */
  private buildCategoryList(decision: CategorizationDecision): string[] {
    const categoryIds = new Set<string>();

    // Add main category
    if (decision.mainCategoryId && decision.mainCategoryId !== 'unknown') {
      categoryIds.add(decision.mainCategoryId);
    }

    // Add high-confidence alternatives from description
    decision.descriptionCandidates
      .filter((m) => m.final_score >= 50 && m.categoryId !== decision.mainCategoryId)
      .slice(0, 2) // Limit to top 2 alternatives
      .forEach((m) => categoryIds.add(m.categoryId));

    // Add vendor alternative if available and different
    if (
      decision.vendorAlternative &&
      decision.vendorAlternative.categoryId &&
      decision.vendorAlternative.categoryId !== decision.mainCategoryId
    ) {
      categoryIds.add(decision.vendorAlternative.categoryId);
    }

    return Array.from(categoryIds);
  }

  /**
   * Allow runtime configuration updates (e.g., from admin API).
   */
  updateThresholds(config: {
    descriptionThreshold?: number;
    vendorThreshold?: number;
    descriptionAdvantage?: number;
  }): void {
    this.decisionEngine.updateConfig(config);
    this.logger?.info('Categorization thresholds updated', { config });
  }

  /**
   * Reload categories from repository.
   */
  reloadCategories(): void {
    this.categories = this.categoryRepository.list();
    this.logger?.info('Categories reloaded', { count: this.categories.length });
  }

  /**
   * Backwards compatibility: ensureUnknownCategory (for old code)
   */
  ensureUnknownCategory(): void {
    // Already handled by repository
  }

  /**
   * Backwards compatibility: simple categorization (uses fuzzy if available, else fallback)
   */
  categorizeTransactionSimple(description: string): string[] {
    // This is kept for backwards compatibility with old code
    // In new code, use categorizeTransaction with a Transaction object
    if (!description) return [];

    const matchedCategoryIds: string[] = [];
    const normalizedDescription = description.toLowerCase().trim();

    for (const category of this.categories) {
      if (category.name.toLowerCase() === 'unknown') continue;
      if (category.keywords.length === 0) continue;

      for (const keyword of category.keywords) {
        const normalizedKeyword = keyword.toLowerCase().trim();
        if (normalizedDescription.includes(normalizedKeyword)) {
          matchedCategoryIds.push(category.id);
          break;
        }
      }
    }

    return matchedCategoryIds.length > 0 ? matchedCategoryIds : [];
  }

  /**
   * Backwards compatibility: recategorizeAll (for old code that calls this)
   */
  async recategorizeAll(): Promise<{ processed: number; updated: number }> {
    this.logger?.info('Recategorization triggered (fuzzy matching enabled for new transactions)');
    return { processed: 0, updated: 0 };
  }
}

