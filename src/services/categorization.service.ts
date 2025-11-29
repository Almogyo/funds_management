import { Logger } from '../utils/logger';
import { CategoryRepository } from '../repositories/category.repository';
import { Category } from '../types';

export class CategorizationService {
  private categories: Category[] = [];
  private readonly UNKNOWN_CATEGORY = 'Unknown';

  constructor(
    private logger: Logger,
    private categoryRepository: CategoryRepository
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

  categorizeTransaction(description: string): string {
    const normalizedDescription = this.normalizeDescription(description);

    for (const category of this.categories) {
      if (category.name === this.UNKNOWN_CATEGORY) {
        continue;
      }

      for (const keyword of category.keywords) {
        const normalizedKeyword = this.normalizeDescription(keyword);
        if (normalizedDescription.includes(normalizedKeyword)) {
          this.logger.debug(`Categorized transaction`, {
            description,
            category: category.name,
            matchedKeyword: keyword,
          });
          return category.name;
        }
      }
    }

    this.logger.debug(`No category match found for transaction, assigning to 'Unknown'`, {
      description,
    });

    return this.UNKNOWN_CATEGORY;
  }

  categorizeBatch(descriptions: string[]): string[] {
    this.logger.info(`Categorizing batch of ${descriptions.length} transactions`);

    const results = descriptions.map((desc) => this.categorizeTransaction(desc));

    const categorized = results.filter((c) => c !== this.UNKNOWN_CATEGORY).length;
    const unknown = results.filter((c) => c === this.UNKNOWN_CATEGORY).length;

    this.logger.info(`Categorized ${categorized}/${descriptions.length} transactions`, {
      known: categorized,
      unknown,
    });

    return results;
  }

  private normalizeDescription(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\u0590-\u05FFa-z0-9\s]/gi, '')
      .trim();
  }

  addCategory(name: string, keywords: string[], parentCategory?: string): Category {
    this.logger.info(`Adding new category`, {
      name,
      keywords,
      parentCategory,
    });

    const category = this.categoryRepository.create(name, parentCategory || null, keywords);
    this.loadCategories();

    return category;
  }

  updateCategoryKeywords(categoryId: string, newKeywords: string[]): void {
    this.logger.info(`Updating category keywords`, {
      categoryId,
      newKeywords,
    });

    this.categoryRepository.update(categoryId, { keywords: newKeywords });
    this.loadCategories();
  }

  getCategoryHierarchy(): Map<string, Category[]> {
    const hierarchy = new Map<string, Category[]>();

    const rootCategories = this.categories.filter((c) => !c.parentCategory);
    hierarchy.set('root', rootCategories);

    for (const category of this.categories) {
      if (category.parentCategory) {
        const children = hierarchy.get(category.parentCategory) || [];
        children.push(category);
        hierarchy.set(category.parentCategory, children);
      }
    }

    return hierarchy;
  }

  suggestCategory(
    description: string,
    topN: number = 3
  ): Array<{ category: string; confidence: number }> {
    const normalizedDescription = this.normalizeDescription(description);
    const descriptionWords = new Set(normalizedDescription.split(/\s+/));

    const scores: Array<{ category: string; confidence: number }> = [];

    for (const category of this.categories) {
      if (category.name === this.UNKNOWN_CATEGORY || category.keywords.length === 0) {
        continue;
      }

      let matchCount = 0;
      let totalKeywords = 0;

      for (const keyword of category.keywords) {
        const normalizedKeyword = this.normalizeDescription(keyword);
        const keywordWords = normalizedKeyword.split(/\s+/);
        totalKeywords += keywordWords.length;

        for (const word of keywordWords) {
          if (descriptionWords.has(word) || normalizedDescription.includes(word)) {
            matchCount++;
          }
        }
      }

      if (matchCount > 0) {
        const confidence = matchCount / totalKeywords;
        scores.push({
          category: category.name,
          confidence: Math.min(confidence, 1.0),
        });
      }
    }

    scores.sort((a, b) => b.confidence - a.confidence);

    return scores.slice(0, topN);
  }

  reloadCategories(): void {
    this.logger.info(`Reloading categories from database`);
    this.loadCategories();
  }

  getUnknownCategory(): string {
    return this.UNKNOWN_CATEGORY;
  }
}