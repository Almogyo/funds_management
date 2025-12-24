import { CategorizeDecisionEngine, DecisionEngineConfig } from '../categorize-decision.engine';
import { DescriptionMatchResult, VendorMatchResult } from '../fuzzy-matching.service';
import { Logger } from '../../utils/logger';

describe('CategorizeDecisionEngine', () => {
  let engine: CategorizeDecisionEngine;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    engine = new CategorizeDecisionEngine(mockLogger);
  });

  const createDescriptionMatch = (
    categoryId: string,
    categoryName: string,
    finalScore: number
  ): DescriptionMatchResult => ({
    categoryId,
    categoryName,
    scores: {
      ratio: finalScore,
      partial_ratio: finalScore,
      token_sort_ratio: finalScore,
      token_set_ratio: finalScore,
    },
    combined_score: finalScore,
    final_score: finalScore,
    source: 'description',
  });

  const createVendorMatch = (
    categoryId: string | null,
    categoryName: string | null,
    finalScore: number
  ): VendorMatchResult => ({
    categoryId,
    categoryName,
    final_score: finalScore,
    source: 'vendor',
  });

  describe('determineMainCategory', () => {
    describe('Description-only scenario (no vendor)', () => {
      it('should select description match above threshold', async () => {
        const descriptionMatches = [createDescriptionMatch('cat1', 'Groceries', 90)];

        const decision = await engine.determineMainCategory(descriptionMatches, null);

        expect(decision.mainCategoryId).toBe('cat1');
        expect(decision.source).toBe('description');
        expect(decision.confidence).toBe('high');
      });

      it('should fallback to Unknown if description below threshold', async () => {
        const descriptionMatches = [createDescriptionMatch('cat1', 'Groceries', 60)];

        const decision = await engine.determineMainCategory(descriptionMatches, null);

        expect(decision.mainCategoryId).toBe('unknown');
        expect(decision.source).toBe('unknown');
        expect(decision.confidence).toBe('low');
      });

      it('should return Unknown if no description matches', async () => {
        const decision = await engine.determineMainCategory([], null);

        expect(decision.mainCategoryId).toBe('unknown');
        expect(decision.source).toBe('unknown');
      });
    });

    describe('Vendor-only scenario (no description)', () => {
      it('should select vendor match above threshold', async () => {
        const vendorMatch = createVendorMatch('cat1', 'Groceries', 70);

        const decision = await engine.determineMainCategory([], vendorMatch);

        expect(decision.mainCategoryId).toBe('cat1');
        expect(decision.source).toBe('vendor');
        expect(decision.confidence).toBe('medium');
      });

      it('should fallback to Unknown if vendor below threshold', async () => {
        const vendorMatch = createVendorMatch('cat1', 'Groceries', 50);

        const decision = await engine.determineMainCategory([], vendorMatch);

        expect(decision.mainCategoryId).toBe('unknown');
        expect(decision.source).toBe('unknown');
      });
    });

    describe('Both available scenario (description + vendor)', () => {
      it('should prefer description if significantly better (>advantage%)', async () => {
        const descriptionMatches = [createDescriptionMatch('cat1', 'Groceries', 85)];
        const vendorMatch = createVendorMatch('cat2', 'Restaurants', 60);

        const decision = await engine.determineMainCategory(descriptionMatches, vendorMatch);

        expect(decision.mainCategoryId).toBe('cat1');
        expect(decision.source).toBe('description');
        expect(decision.reason).toContain('exceeded vendor');
      });

      it('should use vendor if description not significantly better', async () => {
        const descriptionMatches = [createDescriptionMatch('cat1', 'Groceries', 70)];
        const vendorMatch = createVendorMatch('cat2', 'Restaurants', 65);

        const decision = await engine.determineMainCategory(descriptionMatches, vendorMatch);

        expect(decision.mainCategoryId).toBe('cat2');
        expect(decision.source).toBe('vendor');
      });

      it('should use vendor if description below threshold', async () => {
        const descriptionMatches = [createDescriptionMatch('cat1', 'Groceries', 70)];
        const vendorMatch = createVendorMatch('cat2', 'Restaurants', 75);

        const decision = await engine.determineMainCategory(descriptionMatches, vendorMatch);

        expect(decision.mainCategoryId).toBe('cat2');
        expect(decision.source).toBe('vendor');
      });

      it('should apply 10% advantage multiplier correctly', async () => {
        // Description: 75, Vendor: 68
        // 75 > 68 * 1.1 (74.8) = true, should use description
        const descriptionMatches = [createDescriptionMatch('cat1', 'Groceries', 75)];
        const vendorMatch = createVendorMatch('cat2', 'Restaurants', 68);

        const decision = await engine.determineMainCategory(descriptionMatches, vendorMatch);

        expect(decision.mainCategoryId).toBe('cat1');
        expect(decision.source).toBe('description');
      });

      it('should use vendor if not exceeding advantage threshold', async () => {
        // Description: 74, Vendor: 68
        // 74 > 68 * 1.1 (74.8) = false, should use vendor
        const descriptionMatches = [createDescriptionMatch('cat1', 'Groceries', 74)];
        const vendorMatch = createVendorMatch('cat2', 'Restaurants', 68);

        const decision = await engine.determineMainCategory(descriptionMatches, vendorMatch);

        expect(decision.mainCategoryId).toBe('cat2');
        expect(decision.source).toBe('vendor');
      });
    });

    describe('Confidence levels', () => {
      it('should assign high confidence for scores >= 85', async () => {
        const descriptionMatches = [createDescriptionMatch('cat1', 'Groceries', 90)];

        const decision = await engine.determineMainCategory(descriptionMatches, null);

        expect(decision.confidence).toBe('high');
      });

      it('should assign medium confidence for scores >= 70', async () => {
        const descriptionMatches = [createDescriptionMatch('cat1', 'Groceries', 75)];

        const decision = await engine.determineMainCategory(descriptionMatches, null);

        expect(decision.confidence).toBe('medium');
      });

      it('should assign low confidence for scores < 70', async () => {
        const descriptionMatches = [createDescriptionMatch('cat1', 'Groceries', 65)];

        const decision = await engine.determineMainCategory(descriptionMatches, null);

        expect(decision.confidence).toBe('low');
      });
    });

    describe('Alternatives tracking', () => {
      it('should include description alternatives', async () => {
        const descriptionMatches = [
          createDescriptionMatch('cat1', 'Groceries', 85),
          createDescriptionMatch('cat2', 'Markets', 72),
          createDescriptionMatch('cat3', 'Stores', 68),
        ];

        const decision = await engine.determineMainCategory(descriptionMatches, null);

        expect(decision.descriptionAlternatives).toBeDefined();
        expect(decision.descriptionAlternatives?.length).toBeGreaterThan(0);
      });

      it('should include vendor alternative when different from main', async () => {
        const descriptionMatches = [createDescriptionMatch('cat1', 'Groceries', 85)];
        const vendorMatch = createVendorMatch('cat2', 'Restaurants', 70);

        const decision = await engine.determineMainCategory(descriptionMatches, vendorMatch);

        expect(decision.vendorAlternative).toBeDefined();
        expect(decision.vendorAlternative?.categoryId).toBe('cat2');
      });
    });

    describe('Thresholds', () => {
      it('should use default thresholds', async () => {
        const descriptionMatches = [createDescriptionMatch('cat1', 'Groceries', 75)];

        const decision = await engine.determineMainCategory(descriptionMatches, null);

        expect(decision.appliedThresholds.description).toBe(75);
        expect(decision.appliedThresholds.vendor).toBe(60);
      });

      it('should respect custom thresholds', async () => {
        const customConfig: DecisionEngineConfig = {
          descriptionThreshold: 80,
          vendorThreshold: 70,
          descriptionAdvantage: 1.2,
        };

        const customEngine = new CategorizeDecisionEngine(mockLogger, customConfig);
        const descriptionMatches = [createDescriptionMatch('cat1', 'Groceries', 75)];

        const decision = await customEngine.determineMainCategory(descriptionMatches, null);

        expect(decision.mainCategoryId).toBe('unknown'); // 75 < 80
        expect(decision.appliedThresholds.description).toBe(80);
      });
    });

    describe('Config updates', () => {
      it('should allow runtime config updates', async () => {
        const newConfig: Partial<DecisionEngineConfig> = {
          descriptionThreshold: 90,
        };

        engine.updateConfig(newConfig);
        const descriptionMatches = [createDescriptionMatch('cat1', 'Groceries', 85)];

        const decision = await engine.determineMainCategory(descriptionMatches, null);

        expect(decision.mainCategoryId).toBe('unknown'); // 85 < 90
        expect(decision.appliedThresholds.description).toBe(90);
      });
    });

    describe('Edge cases', () => {
      it('should handle zero scores', async () => {
        const descriptionMatches = [createDescriptionMatch('cat1', 'Groceries', 0)];
        const vendorMatch = createVendorMatch('cat2', 'Restaurants', 0);

        const decision = await engine.determineMainCategory(descriptionMatches, vendorMatch);

        expect(decision.mainCategoryId).toBe('unknown');
      });

      it('should handle multiple description matches', async () => {
        const descriptionMatches = [
          createDescriptionMatch('cat1', 'Groceries', 85),
          createDescriptionMatch('cat2', 'Markets', 82),
          createDescriptionMatch('cat3', 'Stores', 78),
        ];

        const decision = await engine.determineMainCategory(descriptionMatches, null);

        expect(decision.mainCategoryId).toBe('cat1'); // Should use top match
        expect(decision.descriptionCandidates.length).toBe(3);
      });

      it('should generate meaningful reason messages', async () => {
        const descriptionMatches = [createDescriptionMatch('cat1', 'Groceries', 85)];

        const decision = await engine.determineMainCategory(descriptionMatches, null);

        expect(decision.reason).toBeDefined();
        expect(decision.reason.length).toBeGreaterThan(0);
      });
    });
  });
});
