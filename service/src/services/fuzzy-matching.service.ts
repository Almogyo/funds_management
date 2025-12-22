import * as fuzzball from 'fuzzball';
import { Logger } from '../utils/logger';

export interface Category {
  id: string;
  name: string;
  keywords: string[];
}

export interface FuzzyScore {
  ratio: number;
  partial_ratio: number;
  token_sort_ratio: number;
  token_set_ratio: number;
}

export interface DescriptionMatchResult {
  categoryId: string;
  categoryName: string;
  scores: FuzzyScore;
  combined_score: number;
  final_score: number;
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
 * Uses fuzzywuzzy library for string similarity matching.
 */
export class FuzzyMatchingService {
  // Weights for combining different fuzzy metrics
  private readonly SCORE_WEIGHTS = {
    ratio: 0.2,
    partial_ratio: 0.3,
    token_sort_ratio: 0.1,
    token_set_ratio: 0.4,
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
      const textsToMatch = [category.name, ...category.keywords].filter(Boolean);

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
        const score = Math.max(scores.partial_ratio, scores.token_set_ratio);

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
      ratio: fuzzball.ratio(str1, str2),
      partial_ratio: fuzzball.partial_ratio(str1, str2),
      token_sort_ratio: fuzzball.token_sort_ratio(str1, str2),
      token_set_ratio: fuzzball.token_set_ratio(str1, str2),
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
   */
  private normalizeText(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, ' ');
  }
}
