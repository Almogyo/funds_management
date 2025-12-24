import { FuzzyMatchingService, Category } from '../fuzzy-matching.service';

describe('FuzzyMatchingService', () => {
  let service: FuzzyMatchingService;

  const mockCategories: Category[] = [
    {
      id: 'cat1',
      name: 'Groceries',
      keywords: ['supermarket', 'grocery store', 'market', 'שופרסל', 'קניון'],
    },
    {
      id: 'cat2',
      name: 'Restaurants',
      keywords: ['restaurant', 'cafe', 'pizza', 'burger', 'פיצה'],
    },
    {
      id: 'cat3',
      name: 'Utilities',
      keywords: ['electric', 'water', 'internet', 'חשמל', 'מים'],
    },
    {
      id: 'cat4',
      name: 'Transportation',
      keywords: ['taxi', 'uber', 'bus', 'train', 'gas station', 'parking'],
    },
    {
      id: 'unknown',
      name: 'Unknown',
      keywords: [],
    },
  ];

  beforeEach(() => {
    service = new FuzzyMatchingService();
  });

  describe('scoreDescriptionAgainstCategories', () => {
    it('should score descriptions against categories', async () => {
      const description = 'Supermarket shopping at Shofershal';
      const results = await service.scoreDescriptionAgainstCategories(description, mockCategories);

      expect(results).toHaveLength(mockCategories.length - 1); // Excludes "Unknown"
      expect(results[0].categoryId).toBe('cat1'); // Groceries should be first
      expect(results[0].final_score).toBeGreaterThan(50);
    });

    it('should handle Hebrew descriptions', async () => {
      const description = 'קניית פירות ירקות בשופרסל';
      const results = await service.scoreDescriptionAgainstCategories(description, mockCategories);

      expect(results).toHaveLength(mockCategories.length - 1);
      expect(results[0].categoryId).toBe('cat1'); // Groceries
      expect(results[0].final_score).toBeGreaterThan(40);
    });

    it('should handle mixed Hebrew and English', async () => {
      const description = 'פיצה Pizza at local restaurant';
      const results = await service.scoreDescriptionAgainstCategories(description, mockCategories);

      expect(results).toHaveLength(mockCategories.length - 1);
      expect(results[0].categoryId).toBe('cat2'); // Restaurants
    });

    it('should filter results below minimum valid score', async () => {
      const description = 'Random text that does not match any category';
      const results = await service.scoreDescriptionAgainstCategories(description, mockCategories);

      // All scores should be 0 (below MIN_VALID_SCORE of 50)
      const validScores = results.filter((r) => r.final_score > 0);
      expect(validScores.length).toBe(0);
    });

    it('should return sorted results by score (descending)', async () => {
      const description = 'Cafe and restaurant';
      const results = await service.scoreDescriptionAgainstCategories(description, mockCategories);

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].final_score).toBeGreaterThanOrEqual(results[i + 1].final_score);
      }
    });

    it('should handle empty description', async () => {
      const results = await service.scoreDescriptionAgainstCategories('', mockCategories);
      expect(results).toEqual([]);
    });

    it('should handle empty categories', async () => {
      const results = await service.scoreDescriptionAgainstCategories('test description', []);
      expect(results).toEqual([]);
    });

    it('should calculate weighted scores combining multiple metrics', async () => {
      const description = 'SUPERMARKET';
      const results = await service.scoreDescriptionAgainstCategories(description, mockCategories);

      const groceriesResult = results.find((r) => r.categoryId === 'cat1');
      expect(groceriesResult).toBeDefined();
      expect(groceriesResult!.scores.ratio).toBeGreaterThan(0);
      expect(groceriesResult!.scores.partial_ratio).toBeGreaterThan(0);
      expect(groceriesResult!.scores.token_sort_ratio).toBeGreaterThan(0);
      expect(groceriesResult!.scores.token_set_ratio).toBeGreaterThan(0);
      expect(groceriesResult!.combined_score).toBeGreaterThan(0);
    });

    it('should handle case insensitivity', async () => {
      const result1 = await service.scoreDescriptionAgainstCategories(
        'SUPERMARKET',
        mockCategories
      );
      const result2 = await service.scoreDescriptionAgainstCategories(
        'supermarket',
        mockCategories
      );

      expect(result1[0].final_score).toBe(result2[0].final_score);
    });

    it('should handle whitespace normalization', async () => {
      const result1 = await service.scoreDescriptionAgainstCategories(
        '  supermarket   ',
        mockCategories
      );
      const result2 = await service.scoreDescriptionAgainstCategories(
        'supermarket',
        mockCategories
      );

      expect(result1[0].final_score).toBe(result2[0].final_score);
    });
  });

  describe('scoreVendorCategoryAgainstCategories', () => {
    it('should score vendor category against all categories', async () => {
      const vendorCategory = 'supermarket';
      const result = await service.scoreVendorCategoryAgainstCategories(
        vendorCategory,
        mockCategories
      );

      expect(result.categoryId).toBe('cat1');
      expect(result.final_score).toBeGreaterThan(50);
    });

    it('should return null categoryId if no match above threshold', async () => {
      const vendorCategory = 'zzzzzzz qqqqqqqq';
      const result = await service.scoreVendorCategoryAgainstCategories(
        vendorCategory,
        mockCategories
      );

      expect(result.categoryId).toBeNull();
      expect(result.final_score).toBeLessThan(50);
    });

    it('should handle empty vendor category', async () => {
      const result = await service.scoreVendorCategoryAgainstCategories('', mockCategories);

      expect(result.categoryId).toBeNull();
      expect(result.final_score).toBe(0);
    });

    it('should find best match across multiple keywords', async () => {
      const vendorCategory = 'pizza restaurant';
      const result = await service.scoreVendorCategoryAgainstCategories(
        vendorCategory,
        mockCategories
      );

      expect(result.categoryId).toBe('cat2'); // Restaurants
      expect(result.final_score).toBeGreaterThan(50);
    });

    it('should have vendor source', async () => {
      const result = await service.scoreVendorCategoryAgainstCategories('restaurant', mockCategories);
      expect(result.source).toBe('vendor');
    });
  });

  describe('normalization', () => {
    it('should normalize text correctly', async () => {
      const descriptions = [
        'Supermarket SHOPPING',
        '  supermarket   shopping  ',
        'SUPERMARKET shopping',
      ];

      const results = await Promise.all(
        descriptions.map((desc) => service.scoreDescriptionAgainstCategories(desc, mockCategories))
      );

      // All should score the same for Groceries category
      const groceriesScores = results.map((r) => r[0]?.final_score);
      expect(groceriesScores[0]).toBe(groceriesScores[1]);
      expect(groceriesScores[1]).toBe(groceriesScores[2]);
    });
  });

  describe('edge cases', () => {
    it('should handle very long descriptions', async () => {
      const longDescription = 'supermarket '.repeat(100);
      const results = await service.scoreDescriptionAgainstCategories(longDescription, mockCategories);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle special characters', async () => {
      const description = "Restaurant @ 123 Main St's #1 location!";
      const results = await service.scoreDescriptionAgainstCategories(description, mockCategories);

      expect(results).toBeDefined();
      const restaurantResult = results.find((r) => r.categoryId === 'cat2');
      expect(restaurantResult?.final_score).toBeGreaterThan(0);
    });

    it('should handle numeric descriptions', async () => {
      const description = 'Payment 123456 for electric bill';
      const results = await service.scoreDescriptionAgainstCategories(description, mockCategories);

      expect(results).toBeDefined();
      const utilitiesResult = results.find((r) => r.categoryId === 'cat3');
      expect(utilitiesResult?.final_score).toBeGreaterThan(0);
    });
  });
});
