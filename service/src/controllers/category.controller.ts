import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { CategoryRepository } from '../repositories/category.repository';
import { CategorizationService } from '../services/categorization.service';
import { Logger } from '../utils/logger';

export class CategoryController {
  constructor(
    private categoryRepository: CategoryRepository,
    private categorizationService: CategorizationService,
    private logger: Logger
  ) {}

  listCategories = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const categories = this.categoryRepository.list();
      res.status(200).json({
        count: categories.length,
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          parentCategory: c.parentCategory,
          keywords: c.keywords,
          createdAt: c.createdAt.getTime(),
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch categories';
      this.logger.error('Get categories error', { error: message });
      res.status(500).json({ error: message });
    }
  };

  createCategory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { name, keywords } = req.body;
      if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }

      const created = this.categoryRepository.create(name, null, keywords || []);

      // Trigger async re-categorization of all transactions
      // This happens in the background without blocking the response
      // Pass the created category ID so it becomes the main category for matching transactions
      this.triggerRecategorization(created.id);

      res.status(201).json({
        category: {
          id: created.id,
          name: created.name,
          keywords: created.keywords,
          createdAt: created.createdAt.getTime(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create category';
      this.logger.error('Create category error', { error: message });
      res.status(500).json({ error: message });
    }
  };

  updateCategory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { name, keywords } = req.body;

      const category = this.categoryRepository.findById(id);
      if (!category) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (keywords !== undefined) updates.keywords = keywords;

      this.categoryRepository.update(id, updates);

      // Trigger async re-categorization of all transactions
      // This happens in the background without blocking the response
      // Pass the updated category ID so it becomes the main category for matching transactions
      this.triggerRecategorization(id);

      res.status(200).json({ message: 'Category updated' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update category';
      this.logger.error('Update category error', { error: message });
      res.status(500).json({ error: message });
    }
  };

  deleteCategory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;

      const category = this.categoryRepository.findById(id);
      if (!category) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      this.categoryRepository.delete(id);

      res.status(200).json({ message: 'Category deleted' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete category';
      this.logger.error('Delete category error', { error: message });
      res.status(500).json({ error: message });
    }
  };

  /**
   * Trigger async re-categorization of all transactions
   * This runs in the background without blocking the HTTP response
   * If forceMainCategoryId is provided, that category will be set as main for matching transactions
   */
  private triggerRecategorization(forceMainCategoryId?: string): void {
    // Use setImmediate to queue the work after the current operation completes
    setImmediate(async () => {
      try {
        this.categorizationService.reloadCategories();
        const result = await this.categorizationService.recategorizeAll();
        this.logger.info('Background re-categorization completed', result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Re-categorization failed';
        this.logger.error('Background re-categorization error', { error: message });
      }
    });
  }
}
