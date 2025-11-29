import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { TransactionRepository } from '../repositories/transaction.repository';
import { AccountRepository } from '../repositories/account.repository';
import { Logger } from '../utils/logger';

export class TransactionController {
  constructor(
    private transactionRepository: TransactionRepository,
    private accountRepository: AccountRepository,
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
      if (categories) filters.categories = (categories as string).split(',');
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
   * /api/transactions/{id}/category:
   *   put:
   *     tags: [Transactions]
   *     summary: Update transaction category
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
   *               - category
   *             properties:
   *               category:
   *                 type: string
   *                 description: New category for the transaction
   *     responses:
   *       200:
   *         description: Category updated successfully
   *       400:
   *         description: Invalid input
   *       401:
   *         description: Authentication required
   *       403:
   *         description: Access denied
   *       404:
   *         description: Transaction not found
   *       500:
   *         description: Server error
   */
  updateCategory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { category } = req.body;

      if (!category) {
        res.status(400).json({ error: 'Category is required' });
        return;
      }

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

      this.transactionRepository.updateCategory(id, category);

      this.logger.info('Transaction category updated', {
        transactionId: id,
        userId,
        newCategory: category,
      });

      res.status(200).json({ message: 'Category updated successfully' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update category';
      this.logger.error('Update category error', { error: message });
      res.status(500).json({ error: message });
    }
  };
}