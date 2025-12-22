# Fuzzy Matching & Decision Engine - Implementation Templates

Ready-to-use TypeScript code for the new categorization system.

---

## 1. FuzzyMatchingService

**File:** `/service/src/services/fuzzy-matching.service.ts`

```typescript
import * as fuzzwuzzy from 'fuzzywuzzy';
import { Logger } from '../utils/logger';
import { Category } from '../types';

export interface FuzzyScore {
  ratio: number;              // Simple character-level similarity (0-100)
  partial_ratio: number;      // Best matching substring (0-100)
  token_sort_ratio: number;   // Ratio after sorting tokens (0-100)
  token_set_ratio: number;    // Ratio of token intersection (0-100)
}

export interface DescriptionMatchResult {
  categoryId: string;
  categoryName: string;
  scores: FuzzyScore;
  combined_score: number;     // Weighted average
  final_score: number;        // 0 if combined < 50, else combined
  source: 'description';
}

export interface VendorMatchResult {
  categoryId: string | null;
  categoryName: string | null;
  final_score: number;
  source: 'vendor';
}

/**
 * Fuzzy matching service for calculating categorization scores.
 * Uses fuzzwuzzy library for string similarity matching.
 */
export class FuzzyMatchingService {
  // Weights for combining different fuzzy metrics
  private readonly SCORE_WEIGHTS = {
    ratio: 0.2,              // Simple match: 20%
    partial_ratio: 0.3,      // Substring match: 30%
    token_sort_ratio: 0.1,   // Token sort: 10%
    token_set_ratio: 0.4,    // Token set (best): 40%
  };

  // Minimum score to consider a match valid
  private readonly MIN_VALID_SCORE = 50;

  constructor(private logger: Logger) {}

  /**
   * Score a transaction description against all categories.
   * Returns results sorted by score (descending).
   */
  async scoreDescriptionAgainstCategories(
    description: string,
    categories: Category[]
  ): Promise<DescriptionMatchResult[]> {
    if (!description || !categories.length) {
      return [];
    }

    const normalizedDescription = this.normalizeText(description);
    const results: DescriptionMatchResult[] = [];

    for (const category of categories) {
      // Skip "Unknown" category - it's the fallback
      if (category.name.toLowerCase() === 'unknown') {
        continue;
      }

      // Build list of texts to match against
      const textsToMatch = [
        category.name,
        ...category.keywords,
      ].filter(Boolean);

      // Find best match across all texts
      let bestScores = this.createZeroScores();
      let highestCombined = 0;

      for (const text of textsToMatch) {
        const normalizedText = this.normalizeText(text);
        const scores = this.calculateScores(normalizedDescription, normalizedText);
        const combined = this.calculateCombinedScore(scores);

        if (combined > highestCombined) {
          highestCombined = combined;
          bestScores = scores;
        }
      }

      const combined_score = this.calculateCombinedScore(bestScores);
      const final_score = combined_score >= this.MIN_VALID_SCORE ? combined_score : 0;

      results.push({
        categoryId: category.id,
        categoryName: category.name,
        scores: bestScores,
        combined_score,
        final_score,
        source: 'description',
      });
    }

    // Sort by final_score descending
    return results.sort((a, b) => b.final_score - a.final_score);
  }

  /**
   * Score a vendor category against all our categories.
   * Returns single best match or null.
   */
  async scoreVendorCategoryAgainstCategories(
    vendorCategoryName: string,
    categories: Category[]
  ): Promise<VendorMatchResult> {
    if (!vendorCategoryName || !categories.length) {
      return {
        categoryId: null,
        categoryName: null,
        final_score: 0,
        source: 'vendor',
      };
    }

    const normalized = this.normalizeText(vendorCategoryName);
    let bestMatch: VendorMatchResult | null = null;
    let bestScore = 0;

    for (const category of categories) {
      if (category.name.toLowerCase() === 'unknown') {
        continue;
      }

      // Try matching against category name and keywords
      const textsToMatch = [category.name, ...category.keywords].filter(Boolean);
      
      for (const text of textsToMatch) {
        const normalizedText = this.normalizeText(text);
        
        // For vendor categories, use a mix of ratios
        const scores = this.calculateScores(normalized, normalizedText);
        const score = Math.max(
          scores.partial_ratio,  // Substring match (highest priority)
          scores.token_set_ratio // Token set match
        );

        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            categoryId: category.id,
            categoryName: category.name,
            final_score: score,
            source: 'vendor',
          };
        }
      }
    }

    // Only return match if above minimum threshold
    if (bestMatch && bestMatch.final_score >= this.MIN_VALID_SCORE) {
      return bestMatch;
    }

    return {
      categoryId: null,
      categoryName: null,
      final_score: 0,
      source: 'vendor',
    };
  }

  /**
   * Calculate all fuzzy matching metrics for two strings.
   */
  private calculateScores(str1: string, str2: string): FuzzyScore {
    return {
      ratio: fuzzwuzzy.ratio(str1, str2),
      partial_ratio: fuzzwuzzy.partialRatio(str1, str2),
      token_sort_ratio: fuzzwuzzy.tokenSortRatio(str1, str2),
      token_set_ratio: fuzzwuzzy.tokenSetRatio(str1, str2),
    };
  }

  /**
   * Calculate weighted combined score from individual metrics.
   */
  private calculateCombinedScore(scores: FuzzyScore): number {
    return Math.round(
      scores.ratio * this.SCORE_WEIGHTS.ratio +
      scores.partial_ratio * this.SCORE_WEIGHTS.partial_ratio +
      scores.token_sort_ratio * this.SCORE_WEIGHTS.token_sort_ratio +
      scores.token_set_ratio * this.SCORE_WEIGHTS.token_set_ratio
    );
  }

  /**
   * Create zero-valued score object.
   */
  private createZeroScores(): FuzzyScore {
    return {
      ratio: 0,
      partial_ratio: 0,
      token_sort_ratio: 0,
      token_set_ratio: 0,
    };
  }

  /**
   * Normalize text for matching.
   * - Lowercase
   * - Trim whitespace
   * - Remove special characters (optional: preserve alphanumeric + Hebrew)
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' '); // Normalize whitespace
  }
}
```

---

## 2. CategorizeDecisionEngine

**File:** `/service/src/services/categorize-decision.engine.ts`

```typescript
import { Logger } from '../utils/logger';
import {
  DescriptionMatchResult,
  VendorMatchResult,
} from './fuzzy-matching.service';

export type CategorizationSource = 'description' | 'vendor' | 'user' | 'unknown';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface CategorizationDecision {
  mainCategoryId: string;
  mainCategoryName?: string;
  
  // All candidate categories
  descriptionCandidates: DescriptionMatchResult[];
  vendorCandidate?: VendorMatchResult;
  
  // Decision metadata
  reason: string;
  confidence: ConfidenceLevel;
  source: CategorizationSource;
  
  // Alternative options (for display)
  descriptionAlternatives?: DescriptionMatchResult[];
  vendorAlternative?: VendorMatchResult;
  
  // Thresholds that were applied
  appliedThresholds: {
    description: number;
    vendor: number;
  };
}

export interface DecisionEngineConfig {
  descriptionThreshold: number;   // default: 75
  vendorThreshold: number;         // default: 60
  descriptionAdvantage: number;    // default: 1.1 (10% better)
}

/**
 * Decision engine for determining main category using hierarchical logic.
 * Implements the prioritization: description > vendor > unknown
 */
export class CategorizeDecisionEngine {
  private config: DecisionEngineConfig = {
    descriptionThreshold: 75,
    vendorThreshold: 60,
    descriptionAdvantage: 1.1, // 10% better
  };

  constructor(
    private logger: Logger,
    config?: Partial<DecisionEngineConfig>
  ) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Apply decision hierarchy to determine main category.
   * Returns null categoryId if no match found (will be set to "Unknown").
   */
  async determineMainCategory(
    descriptionMatches: DescriptionMatchResult[],
    vendorMatch: VendorMatchResult | null,
    categoryNameMap?: Map<string, string>
  ): Promise<CategorizationDecision> {
    const topDescriptionMatch = descriptionMatches[0];

    // Scenario 1: No vendor category or vendor score below threshold
    if (!vendorMatch || vendorMatch.final_score < this.config.vendorThreshold) {
      this.logger.debug('No vendor category available or below threshold', {
        vendorScore: vendorMatch?.final_score,
        threshold: this.config.vendorThreshold,
      });

      return this.handleDescriptionOnly(
        topDescriptionMatch,
        descriptionMatches
      );
    }

    // Scenario 2: Vendor category is available and above threshold
    // Check if description is significantly better (by descriptionAdvantage%)
    if (
      topDescriptionMatch &&
      topDescriptionMatch.final_score >= this.config.descriptionThreshold &&
      topDescriptionMatch.final_score >
        vendorMatch.final_score * this.config.descriptionAdvantage
    ) {
      // Description score is high enough and better than vendor
      this.logger.debug('Description match exceeds vendor by advantage threshold', {
        descriptionScore: topDescriptionMatch.final_score,
        vendorScore: vendorMatch.final_score,
        advantage: this.config.descriptionAdvantage,
      });

      return {
        mainCategoryId: topDescriptionMatch.categoryId,
        mainCategoryName: topDescriptionMatch.categoryName,
        descriptionCandidates: descriptionMatches,
        vendorCandidate: vendorMatch,
        reason: `Description match (${topDescriptionMatch.final_score.toFixed(1)}%) exceeded vendor (${vendorMatch.final_score.toFixed(1)}%) by ${this.config.descriptionAdvantage * 100 - 100}%`,
        confidence: this.getConfidence(topDescriptionMatch.final_score),
        source: 'description',
        vendorAlternative: vendorMatch,
        appliedThresholds: {
          description: this.config.descriptionThreshold,
          vendor: this.config.vendorThreshold,
        },
      };
    }

    // Scenario 3: Vendor wins (either description below threshold or lower than vendor)
    this.logger.debug('Using vendor category', {
      vendorScore: vendorMatch.final_score,
      descriptionScore: topDescriptionMatch?.final_score || 0,
      reason: topDescriptionMatch
        ? 'Description below advantage threshold'
        : 'No valid description match',
    });

    return {
      mainCategoryId: vendorMatch.categoryId,
      mainCategoryName: vendorMatch.categoryName,
      descriptionCandidates: descriptionMatches,
      vendorCandidate: vendorMatch,
      reason: vendorMatch.categoryId
        ? `Vendor categorization selected (score: ${vendorMatch.final_score.toFixed(1)}%)`
        : 'Vendor category not determinable',
      confidence: this.getConfidence(vendorMatch.final_score),
      source: 'vendor',
      descriptionAlternatives: descriptionMatches.filter(
        (m) => m.final_score >= this.config.descriptionThreshold
      ),
      appliedThresholds: {
        description: this.config.descriptionThreshold,
        vendor: this.config.vendorThreshold,
      },
    };
  }

  /**
   * Handle case where only description matching is available.
   */
  private handleDescriptionOnly(
    topMatch: DescriptionMatchResult | undefined,
    allMatches: DescriptionMatchResult[]
  ): CategorizationDecision {
    if (topMatch && topMatch.final_score >= this.config.descriptionThreshold) {
      this.logger.debug('Using description match (no vendor)', {
        score: topMatch.final_score,
      });

      return {
        mainCategoryId: topMatch.categoryId,
        mainCategoryName: topMatch.categoryName,
        descriptionCandidates: allMatches,
        reason: `Description match above threshold (${topMatch.final_score.toFixed(1)}%)`,
        confidence: this.getConfidence(topMatch.final_score),
        source: 'description',
        descriptionAlternatives: allMatches.filter(
          (m) => m.final_score >= 50 && m.categoryId !== topMatch.categoryId
        ),
        appliedThresholds: {
          description: this.config.descriptionThreshold,
          vendor: this.config.vendorThreshold,
        },
      };
    }

    // No match at all
    this.logger.debug('No match above thresholds, using Unknown', {
      topDescriptionScore: topMatch?.final_score || 0,
    });

    return {
      mainCategoryId: 'unknown',
      mainCategoryName: 'Unknown',
      descriptionCandidates: allMatches,
      reason: 'No category matched confidence threshold - defaulting to Unknown',
      confidence: 'low',
      source: 'unknown',
      descriptionAlternatives: allMatches.filter(
        (m) => m.final_score > 0
      ),
      appliedThresholds: {
        description: this.config.descriptionThreshold,
        vendor: this.config.vendorThreshold,
      },
    };
  }

  /**
   * Determine confidence level based on score.
   */
  private getConfidence(score: number): ConfidenceLevel {
    if (score >= 85) return 'high';
    if (score >= 70) return 'medium';
    return 'low';
  }

  /**
   * Update configuration at runtime.
   */
  updateConfig(config: Partial<DecisionEngineConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Decision engine config updated', { config: this.config });
  }
}
```

---

## 3. Updated CategorizationService

**File:** `/service/src/services/categorization.service.ts` (complete rewrite)

```typescript
import { Logger } from '../utils/logger';
import { CategoryRepository } from '../repositories/category.repository';
import { TransactionBase, CreditCardTransaction } from '../models';
import { IsracardTransaction } from '../models/transaction.isracard';
import { MaxTransaction } from '../models/transaction.max';
import { VisaCalTransaction } from '../models/transaction.visacal';
import { FuzzyMatchingService, DescriptionMatchResult, VendorMatchResult } from './fuzzy-matching.service';
import { CategorizeDecisionEngine, CategorizationDecision } from './categorize-decision.engine';
import { CategoryScoreRepository } from '../repositories/category-score.repository';

export interface CategorizationResult {
  mainCategoryId: string;
  allCategoryIds: string[]; // main + alternatives
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
  private fuzzyService: FuzzyMatchingService;
  private decisionEngine: CategorizeDecisionEngine;

  constructor(
    private categoryRepository: CategoryRepository,
    private categoryScoreRepository: CategoryScoreRepository,
    private logger: Logger,
    config?: {
      descriptionThreshold?: number;
      vendorThreshold?: number;
      descriptionAdvantage?: number;
    }
  ) {
    this.fuzzyService = new FuzzyMatchingService(logger);
    this.decisionEngine = new CategorizeDecisionEngine(
      logger,
      config && {
        descriptionThreshold: config.descriptionThreshold,
        vendorThreshold: config.vendorThreshold,
        descriptionAdvantage: config.descriptionAdvantage,
      }
    );
  }

  /**
   * Main categorization method.
   * Returns primary category + alternatives with confidence scores.
   */
  async categorizeTransaction(
    transaction: TransactionBase
  ): Promise<CategorizationResult> {
    const categories = this.categoryRepository.list();

    // Step 1: Fuzzy match description against all categories
    const descriptionMatches = await this.fuzzyService
      .scoreDescriptionAgainstCategories(
        transaction.description,
        categories
      );

    // Step 2: Extract and fuzzy match vendor category (if available)
    let vendorMatch: VendorMatchResult | null = null;
    const vendorCategoryName = this.extractVendorCategory(transaction);
    
    if (vendorCategoryName) {
      vendorMatch = await this.fuzzyService
        .scoreVendorCategoryAgainstCategories(
          vendorCategoryName,
          categories
        );
    }

    // Step 3: Apply decision hierarchy
    const decision = await this.decisionEngine.determineMainCategory(
      descriptionMatches,
      vendorMatch
    );

    // Step 4: Record scores for analysis and learning
    if (transaction.id) {
      await this.categoryScoreRepository.recordCategorization({
        transactionId: transaction.id,
        accountId: transaction.accountId,
        vendorId: transaction.vendorId,
        description: transaction.description,
        descriptionScores: descriptionMatches,
        vendorScore: vendorMatch,
        decision,
        timestamp: new Date(),
      });
    }

    this.logger.debug('Categorized transaction', {
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
  private extractVendorCategory(transaction: TransactionBase): string | null {
    if (!(transaction instanceof CreditCardTransaction)) {
      return null;
    }

    if (transaction instanceof IsracardTransaction) {
      return transaction.enrichmentData.sector || null;
    }

    if (transaction instanceof MaxTransaction) {
      // For Max, we might use category ID or category name if available
      return transaction.enrichmentData.maxCategoryId?.toString() || null;
    }

    if (transaction instanceof VisaCalTransaction) {
      // For Visa Cal, use merchant branch code or full merchant name
      return transaction.enrichmentData.merchantMetadata?.branchCode || null;
    }

    return null;
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
    this.logger.info('Categorization thresholds updated', { config });
  }
}
```

---

## 4. Category Score Repository

**File:** `/service/src/repositories/category-score.repository.ts`

```typescript
import { Database } from 'better-sqlite3';
import { Logger } from '../utils/logger';
import { DescriptionMatchResult, VendorMatchResult } from '../services/fuzzy-matching.service';
import { CategorizationDecision } from '../services/categorize-decision.engine';
import { randomUUID } from 'crypto';

export interface CategorizationRecord {
  transactionId: string;
  accountId: string;
  vendorId: string;
  description: string;
  descriptionScores: DescriptionMatchResult[];
  vendorScore: VendorMatchResult | null;
  decision: CategorizationDecision;
  timestamp: Date;
}

export interface UserOverride {
  transactionId: string;
  previousMainCategoryId: string;
  newMainCategoryId: string;
  userId: string;
  reason?: string;
  timestamp: Date;
}

/**
 * Repository for storing and analyzing categorization scores.
 * Used for understanding system categorization quality and learning from user overrides.
 */
export class CategoryScoreRepository {
  constructor(
    private db: Database,
    private logger: Logger
  ) {}

  /**
   * Record categorization scores for a transaction.
   * Stores detailed scoring information for audit and learning.
   */
  recordCategorization(record: CategorizationRecord): void {
    try {
      const id = randomUUID();
      const now = new Date();

      const stmt = this.db.prepare(`
        INSERT INTO category_scores (
          id,
          transaction_id,
          account_id,
          vendor_id,
          description,
          description_top_score,
          description_top_category_id,
          vendor_score,
          vendor_category_id,
          main_category_id,
          decision_source,
          decision_confidence,
          decision_reason,
          calculated_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        record.transactionId,
        record.accountId,
        record.vendorId,
        record.description,
        record.descriptionScores[0]?.final_score || 0,
        record.descriptionScores[0]?.categoryId || null,
        record.vendorScore?.final_score || 0,
        record.vendorScore?.categoryId || null,
        record.decision.mainCategoryId,
        record.decision.source,
        record.decision.confidence,
        record.decision.reason,
        record.timestamp.toISOString(),
        now.toISOString()
      );

      this.logger.debug('Recorded categorization scores', {
        transactionId: record.transactionId,
        source: record.decision.source,
      });
    } catch (error) {
      this.logger.error('Failed to record categorization scores', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId: record.transactionId,
      });
    }
  }

  /**
   * Record user override of category selection.
   */
  recordUserOverride(override: UserOverride): void {
    try {
      const id = randomUUID();

      const stmt = this.db.prepare(`
        INSERT INTO category_overrides (
          id,
          transaction_id,
          previous_main_category_id,
          new_main_category_id,
          user_id,
          reason,
          overridden_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        override.transactionId,
        override.previousMainCategoryId,
        override.newMainCategoryId,
        override.userId,
        override.reason || null,
        override.timestamp.toISOString(),
        new Date().toISOString()
      );

      this.logger.info('Recorded category override', {
        transactionId: override.transactionId,
        userId: override.userId,
        from: override.previousMainCategoryId,
        to: override.newMainCategoryId,
      });
    } catch (error) {
      this.logger.error('Failed to record category override', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId: override.transactionId,
      });
    }
  }

  /**
   * Get categorization analysis for learning purposes.
   */
  getCategorizationAnalytics(filters?: {
    vendorId?: string;
    source?: string;
    confidenceLevel?: string;
    startDate?: Date;
    endDate?: Date;
  }): any {
    let sql = 'SELECT * FROM category_scores WHERE 1=1';
    const params: any[] = [];

    if (filters?.vendorId) {
      sql += ' AND vendor_id = ?';
      params.push(filters.vendorId);
    }

    if (filters?.source) {
      sql += ' AND decision_source = ?';
      params.push(filters.source);
    }

    if (filters?.confidenceLevel) {
      sql += ' AND decision_confidence = ?';
      params.push(filters.confidenceLevel);
    }

    if (filters?.startDate) {
      sql += ' AND calculated_at >= ?';
      params.push(filters.startDate.toISOString());
    }

    if (filters?.endDate) {
      sql += ' AND calculated_at <= ?';
      params.push(filters.endDate.toISOString());
    }

    sql += ' ORDER BY calculated_at DESC LIMIT 10000';

    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Analyze override patterns to identify system weaknesses.
   */
  getOverridePatterns(): any {
    const sql = `
      SELECT 
        cs.description_top_category_id as system_choice,
        co.new_main_category_id as user_choice,
        COUNT(*) as override_count,
        AVG(cs.description_top_score) as avg_system_score,
        ROUND(AVG(cs.description_top_score), 2) as avg_confidence
      FROM category_scores cs
      INNER JOIN category_overrides co ON cs.transaction_id = co.transaction_id
      WHERE co.previous_main_category_id = cs.main_category_id
      GROUP BY cs.description_top_category_id, co.new_main_category_id
      ORDER BY override_count DESC
      LIMIT 50
    `;

    const stmt = this.db.prepare(sql);
    return stmt.all();
  }
}
```

---

## 5. Database Migration

**File:** `/service/migrations/add_fuzzy_matching_tables.sql`

```sql
-- Categorization scores audit table
CREATE TABLE IF NOT EXISTS category_scores (
  id UUID PRIMARY KEY,
  transaction_id UUID NOT NULL,
  account_id UUID NOT NULL,
  vendor_id VARCHAR NOT NULL,
  description TEXT NOT NULL,
  
  -- Description matching scores
  description_top_score FLOAT,           -- Top fuzzy match score
  description_top_category_id UUID,      -- Top matching category ID
  
  -- Vendor matching scores
  vendor_score FLOAT,                    -- Vendor category fuzzy match
  vendor_category_id UUID,               -- Vendor's chosen category ID
  
  -- Decision information
  main_category_id UUID,                 -- Final chosen category
  decision_source VARCHAR,               -- 'description' | 'vendor' | 'unknown'
  decision_confidence VARCHAR,           -- 'high' | 'medium' | 'low'
  decision_reason TEXT,                  -- Reasoning for decision
  
  -- Timestamps
  calculated_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL,
  
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX idx_category_scores_transaction_id ON category_scores(transaction_id);
CREATE INDEX idx_category_scores_vendor_id ON category_scores(vendor_id);
CREATE INDEX idx_category_scores_source ON category_scores(decision_source);
CREATE INDEX idx_category_scores_confidence ON category_scores(decision_confidence);
CREATE INDEX idx_category_scores_calculated_at ON category_scores(calculated_at);

-- User overrides audit table
CREATE TABLE IF NOT EXISTS category_overrides (
  id UUID PRIMARY KEY,
  transaction_id UUID NOT NULL,
  previous_main_category_id UUID,
  new_main_category_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reason TEXT,
  overridden_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL,
  
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_category_overrides_transaction_id ON category_overrides(transaction_id);
CREATE INDEX idx_category_overrides_user_id ON category_overrides(user_id);
CREATE INDEX idx_category_overrides_overridden_at ON category_overrides(overridden_at);

-- Add columns to transaction_categories for manual override tracking
ALTER TABLE transaction_categories 
ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'system';
-- source: 'description' | 'vendor' | 'user'

-- Analytics query: Override patterns
-- SELECT 
--   cs.description_top_category_id,
--   co.new_main_category_id,
--   COUNT(*) as override_count
-- FROM category_scores cs
-- INNER JOIN category_overrides co ON cs.transaction_id = co.transaction_id
-- GROUP BY cs.description_top_category_id, co.new_main_category_id
-- ORDER BY override_count DESC;
```

---

## 6. User Override Controller

**File:** `/service/src/controllers/transaction.controller.ts` (excerpt)

```typescript
import { Router, Request, Response } from 'express';
import { TransactionRepository } from '../repositories/transaction.repository';
import { CategoryScoreRepository } from '../repositories/category-score.repository';
import { authMiddleware } from '../middleware/auth.middleware';
import { Logger } from '../utils/logger';

export class TransactionController {
  constructor(
    private transactionRepository: TransactionRepository,
    private categoryScoreRepository: CategoryScoreRepository,
    private logger: Logger
  ) {}

  /**
   * PUT /api/transactions/:id/category
   * Allow user to override transaction category
   */
  async setTransactionCategory(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { mainCategoryId, reason } = req.body;
      const userId = (req as any).user.id;

      // Validate input
      if (!mainCategoryId) {
        res.status(400).json({ error: 'mainCategoryId is required' });
        return;
      }

      // Get current transaction
      const transaction = await this.transactionRepository.getById(id);
      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      const previousMainCategoryId = transaction.mainCategoryId;

      // Update transaction
      await this.transactionRepository.setMainCategory(
        id,
        mainCategoryId
      );

      // Update transaction_categories to mark as manual/user-selected
      await this.transactionRepository.updateCategorySource(
        id,
        mainCategoryId,
        'user'
      );

      // Record override for analysis
      this.categoryScoreRepository.recordUserOverride({
        transactionId: id,
        previousMainCategoryId: previousMainCategoryId || 'unknown',
        newMainCategoryId: mainCategoryId,
        userId,
        reason: reason || undefined,
        timestamp: new Date(),
      });

      this.logger.info('Transaction category overridden by user', {
        transactionId: id,
        userId,
        previousCategory: previousMainCategoryId,
        newCategory: mainCategoryId,
        reason: reason || 'Not provided',
      });

      // Return updated transaction
      const updated = await this.transactionRepository.getById(id);
      res.json({
        success: true,
        message: 'Category updated',
        transaction: updated,
      });
    } catch (error) {
      this.logger.error('Failed to set transaction category', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId: (req as any).params.id,
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * GET /api/categorization/analytics
   * Get categorization quality metrics
   */
  async getCatgorizationAnalytics(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const {
        vendorId,
        source,
        confidence,
        startDate,
        endDate,
      } = req.query;

      const analytics = this.categoryScoreRepository.getCategorizationAnalytics({
        vendorId: vendorId as string | undefined,
        source: source as string | undefined,
        confidenceLevel: confidence as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      const patterns = this.categoryScoreRepository.getOverridePatterns();

      res.json({
        analytics,
        patterns,
      });
    } catch (error) {
      this.logger.error('Failed to get categorization analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
```

---

## Package Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "fuzzywuzzy": "^1.0.0"
  },
  "optionalDependencies": {
    "python-Levenshtein": "^0.20.0"
  }
}
```

**Note:** `python-Levenshtein` is optional but recommended for faster fuzzy matching (C extension).

---

## Integration Checklist

- [ ] Install fuzzywuzzy library
- [ ] Create FuzzyMatchingService
- [ ] Create CategorizeDecisionEngine
- [ ] Update CategorizationService
- [ ] Create CategoryScoreRepository
- [ ] Run database migrations
- [ ] Create/update Transaction controller endpoints
- [ ] Add unit tests for fuzzy matching
- [ ] Add integration tests with real transaction data
- [ ] Configure thresholds (description: 75, vendor: 60, advantage: 1.1)
- [ ] Deploy and monitor override patterns
- [ ] Adjust thresholds based on analytics
