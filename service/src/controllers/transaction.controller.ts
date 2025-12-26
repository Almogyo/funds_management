import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { TransactionRepository } from '../repositories/transaction.repository';
import { TransactionService } from '../services/transaction.service';
import { AccountRepository } from '../repositories/account.repository';
import { CategoryRepository } from '../repositories/category.repository';
import { Logger } from '../utils/logger';

export class TransactionController {
  constructor(
    private transactionRepository: TransactionRepository,
    private transactionService: TransactionService,
    private accountRepository: AccountRepository,
    private categoryRepository: CategoryRepository,
    private logger: Logger
  ) {}

  /**
   * @swagger
   * /api/transactions:
   *   get:
   *     tags: [Transactions]
   *     summary: Get all transactions for authenticated user with filters
   *     security:
   *       - SessionAuth: []
   *     parameters:
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter transactions from this date
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter transactions until this date
   *       - in: query
   *         name: categories
   *         schema:
   *           type: string
   *         description: Comma-separated list of categories to filter by
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [completed, pending]
   *         description: Filter by transaction status
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: Maximum number of transactions to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *         description: Number of transactions to skip
   *     responses:
   *       200:
   *         description: List of transactions
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Server error
   */
  getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { startDate, endDate, categories, status, limit, offset } = req.query;

      const accounts = this.accountRepository.findByUserId(userId);
      const accountIds = accounts.map((a) => a.id);

      const filters: any = { accountIds };

      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (categories) {
        const categoryIds = (categories as string).split(',');
        // map ids to category names
        const names: string[] = categoryIds
          .map((id) => this.categoryRepository.findById(id))
          .filter((c): c is any => !!c)
          .map((c) => c.name);
        if (names.length > 0) {
          filters.categories = names;
        }
      }
      if (status) filters.status = status as 'completed' | 'pending';

      const limitNum = limit ? parseInt(limit as string, 10) : undefined;
      const offsetNum = offset ? parseInt(offset as string, 10) : undefined;

      const transactions = this.transactionRepository.findWithFilters(
        filters,
        limitNum,
        offsetNum
      );

      res.status(200).json({
        count: transactions.length,
        transactions,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch transactions';
      this.logger.error('Get transactions error', { error: message });
      res.status(500).json({ error: message });
    }
  };

  /**
   * @swagger
   * /api/transactions/{id}:
   *   get:
   *     tags: [Transactions]
   *     summary: Get a single transaction by ID
   *     security:
   *       - SessionAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Transaction ID
   *     responses:
   *       200:
   *         description: Transaction details
   *       401:
   *         description: Authentication required
   *       403:
   *         description: Access denied
   *       404:
   *         description: Transaction not found
   *       500:
   *         description: Server error
   */
  getTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;

      const transaction = this.transactionRepository.findById(id);
      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      const account = this.accountRepository.findById(transaction.accountId);
      if (!account || account.userId !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      res.status(200).json(transaction);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch transaction';
      this.logger.error('Get transaction error', { error: message });
      res.status(500).json({ error: message });
    }
  };

  /**
   * @swagger
   * /api/transactions/{id}/set-main-category:
   *   post:
   *     tags: [Transactions]
   *     summary: Set a category as the main category for a transaction
   *     description: Sets the specified category as the main category for analytics, unsets main from other categories
   *     security:
   *       - SessionAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Transaction ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - categoryId
   *             properties:
   *               categoryId:
   *                 type: string
   *                 description: Category ID to set as main
   *     responses:
   *       200:
   *         description: Main category updated successfully
   *       400:
   *         description: Invalid request
   *       401:
   *         description: Authentication required
   *       403:
   *         description: Access denied
   *       404:
   *         description: Transaction or category not found
   *       500:
   *         description: Server error
   */
  setMainCategory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id: transactionId } = req.params;
      // Support both { categoryId } and { category } for backwards compatibility
      const categoryId = req.body.categoryId || req.body.category;

      if (!categoryId) {
        res.status(400).json({ error: 'Category ID is required' });
        return;
      }

      const transaction = this.transactionRepository.findById(transactionId);
      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      const account = this.accountRepository.findById(transaction.accountId);
      if (!account || account.userId !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Use the service to set the main category
      // The service handles all business logic: verifying category exists,
      // attaching category if not already attached, updating junction table,
      // and syncing the main_category_id column
      this.transactionService.setMainCategory(transactionId, categoryId, true);

      this.logger.info(`Set main category for transaction`, {
        transactionId,
        categoryId,
        userId,
      });

      res.status(200).json({
        message: 'Main category updated successfully',
        transactionId,
        categoryId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set main category';
      this.logger.error('Set main category error', { error: message });
      res.status(500).json({ error: message });
    }
  };
}
