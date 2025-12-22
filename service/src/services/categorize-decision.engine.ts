import { Logger } from '../utils/logger';
import { DescriptionMatchResult, VendorMatchResult } from './fuzzy-matching.service';

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
  descriptionThreshold: number;
  vendorThreshold: number;
  descriptionAdvantage: number;
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

  constructor(private logger: Logger, config?: Partial<DecisionEngineConfig>) {
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
    vendorMatch: VendorMatchResult | null
  ): Promise<CategorizationDecision> {
    const topDescriptionMatch = descriptionMatches[0];

    // Scenario 1: No vendor category or vendor score below threshold
    if (!vendorMatch || vendorMatch.final_score < this.config.vendorThreshold) {
      this.logger.debug('No vendor category available or below threshold', {
        vendorScore: vendorMatch?.final_score,
        threshold: this.config.vendorThreshold,
      });

      return this.handleDescriptionOnly(topDescriptionMatch, descriptionMatches);
    }

    // Scenario 2: Vendor category is available and above threshold
    // Check if description is significantly better (by descriptionAdvantage%)
    if (
      topDescriptionMatch &&
      topDescriptionMatch.final_score >= this.config.descriptionThreshold &&
      topDescriptionMatch.final_score > vendorMatch.final_score * this.config.descriptionAdvantage
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
      reason: topDescriptionMatch ? 'Description below advantage threshold' : 'No valid description match',
    });

    return {
      mainCategoryId: vendorMatch.categoryId || 'unknown',
      mainCategoryName: vendorMatch.categoryName || undefined,
      descriptionCandidates: descriptionMatches,
      vendorCandidate: vendorMatch,
      reason: vendorMatch.categoryId
        ? `Vendor categorization selected (score: ${vendorMatch.final_score.toFixed(1)}%)`
        : 'Vendor category not determinable',
      confidence: this.getConfidence(vendorMatch.final_score),
      source: vendorMatch.categoryId ? 'vendor' : 'unknown',
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
      descriptionAlternatives: allMatches.filter((m) => m.final_score > 0),
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
