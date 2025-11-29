import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { AnalyticsService } from '../services/analytics.service';
import { AccountRepository } from '../repositories/account.repository';
import { Logger } from '../utils/logger';

export class AnalyticsController {
  constructor(
    private analyticsService: AnalyticsService,
    private accountRepository: AccountRepository,
    private logger: Logger
  ) {}

  /**
   * @swagger
   * /api/analytics/summary:
   *   get:
   *     tags: [Analytics]
   *     summary: Get financial summary for user accounts
   *     security:
   *       - SessionAuth: []
   *     parameters:
   *       - in: query
   *         name: accountIds
   *         schema:
   *           type: string
   *         description: Comma-separated list of account IDs (optional, defaults to all user accounts)
   *       - in: query
   *         name: startDate
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *         description: Start date for summary period
   *       - in: query
   *         name: endDate
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *         description: End date for summary period
   *     responses:
   *       200:
   *         description: Financial summary
   *       400:
   *         description: Invalid input
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Server error
   */
  getSummary = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { startDate, endDate, accountIds: accountIdsParam } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({ error: 'Start date and end date are required' });
        return;
      }

      const dateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      };

      let accountIds: string[];
      if (accountIdsParam && typeof accountIdsParam === 'string') {
        accountIds = accountIdsParam.split(',').map((id) => id.trim());
      } else {
        const accounts = this.accountRepository.findActiveByUserId(userId);
        accountIds = accounts.map((a) => a.id);
      }

      const summary = this.analyticsService.calculateSummary(accountIds, dateRange);

      res.status(200).json(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to calculate summary';
      this.logger.error('Analytics summary error', { error: message });
      res.status(500).json({ error: message });
    }
  };

  /**
   * @swagger
   * /api/analytics/highest-expense:
   *   get:
   *     tags: [Analytics]
   *     summary: Get highest expense in the specified period
   *     security:
   *       - SessionAuth: []
   *     parameters:
   *       - in: query
   *         name: accountIds
   *         schema:
   *           type: string
   *         description: Comma-separated list of account IDs (optional, defaults to all user accounts)
   *       - in: query
   *         name: startDate
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *         description: Start date for analysis period
   *       - in: query
   *         name: endDate
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *         description: End date for analysis period
   *     responses:
   *       200:
   *         description: Highest expense details
   *       400:
   *         description: Invalid input
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Server error
   */
  getHighestExpense = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { startDate, endDate, accountIds: accountIdsParam } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({ error: 'Start date and end date are required' });
        return;
      }

      const dateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      };

      let accountIds: string[];
      if (accountIdsParam && typeof accountIdsParam === 'string') {
        accountIds = accountIdsParam.split(',').map((id) => id.trim());
      } else {
        const accounts = this.accountRepository.findActiveByUserId(userId);
        accountIds = accounts.map((a) => a.id);
      }

      const highestExpense = this.analyticsService.calculateHighestExpense(accountIds, dateRange);

      res.status(200).json(highestExpense);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to calculate highest expense';
      this.logger.error('Highest expense error', { error: message });
      res.status(500).json({ error: message });
    }
  };

  /**
   * @swagger
   * /api/analytics/recurring-payments:
   *   get:
   *     tags: [Analytics]
   *     summary: Get recurring payments analysis
   *     security:
   *       - SessionAuth: []
   *     parameters:
   *       - in: query
   *         name: accountIds
   *         schema:
   *           type: string
   *         description: Comma-separated list of account IDs (optional, defaults to all user accounts)
   *       - in: query
   *         name: startDate
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *         description: Start date for analysis period
   *       - in: query
   *         name: endDate
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *         description: End date for analysis period
   *       - in: query
   *         name: minOccurrences
   *         schema:
   *           type: integer
   *           default: 5
   *         description: Minimum number of occurrences to identify as recurring
   *     responses:
   *       200:
   *         description: List of recurring payments
   *       400:
   *         description: Invalid input
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Server error
   */
  getRecurringPayments = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { startDate, endDate, topN, accountIds: accountIdsParam } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({ error: 'Start date and end date are required' });
        return;
      }

      const dateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      };

      let accountIds: string[];
      if (accountIdsParam && typeof accountIdsParam === 'string') {
        accountIds = accountIdsParam.split(',').map(id => id.trim());
      } else {
        const accounts = this.accountRepository.findActiveByUserId(userId);
        accountIds = accounts.map((a) => a.id);
      }

      const top = topN ? parseInt(topN as string, 10) : 5;
      const recurringPayments = this.analyticsService.calculateTopRecurringPayments(
        accountIds,
        dateRange,
        top
      );

      res.status(200).json({ payments: recurringPayments });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to calculate recurring payments';
      this.logger.error('Recurring payments error', { error: message });
      res.status(500).json({ error: message });
    }
  };

  /**
   * @swagger
   * /api/analytics/trends:
   *   get:
   *     tags: [Analytics]
   *     summary: Get expense trends over time
   *     security:
   *       - SessionAuth: []
   *     parameters:
   *       - in: query
   *         name: accountIds
   *         schema:
   *           type: string
   *         description: Comma-separated list of account IDs (optional, defaults to all user accounts)
   *       - in: query
   *         name: startDate
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *         description: Start date for analysis period
   *       - in: query
   *         name: endDate
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *         description: End date for analysis period
   *       - in: query
   *         name: granularity
   *         schema:
   *           type: string
   *           enum: [daily, monthly]
   *           default: monthly
   *         description: Time granularity for trend analysis
   *     responses:
   *       200:
   *         description: Expense trends data
   *       400:
   *         description: Invalid input
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Server error
   */
  getTrends = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { startDate, endDate, granularity, accountIds: accountIdsParam } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({ error: 'Start date and end date are required' });
        return;
      }

      const dateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      };

      let accountIds: string[];
      if (accountIdsParam && typeof accountIdsParam === 'string') {
        accountIds = accountIdsParam.split(',').map(id => id.trim());
      } else {
        const accounts = this.accountRepository.findActiveByUserId(userId);
        accountIds = accounts.map((a) => a.id);
      }

      const gran = (granularity as 'daily' | 'monthly') || 'monthly';
      const trends = this.analyticsService.calculateExpenseTrends(accountIds, dateRange, gran);

      res.status(200).json({ trends });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to calculate trends';
      this.logger.error('Trends error', { error: message });
      res.status(500).json({ error: message });
    }
  };

  /**
   * @swagger
   * /api/analytics/category-distribution:
   *   get:
   *     tags: [Analytics]
   *     summary: Get expense distribution by category
   *     security:
   *       - SessionAuth: []
   *     parameters:
   *       - in: query
   *         name: accountIds
   *         schema:
   *           type: string
   *         description: Comma-separated list of account IDs (optional, defaults to all user accounts)
   *       - in: query
   *         name: startDate
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *         description: Start date for analysis period
   *       - in: query
   *         name: endDate
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *         description: End date for analysis period
   *     responses:
   *       200:
   *         description: Category distribution data
   *       400:
   *         description: Invalid input
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Server error
   */
  getCategoryDistribution = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { startDate, endDate, accountIds: accountIdsParam } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({ error: 'Start date and end date are required' });
        return;
      }

      const dateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      };

      let accountIds: string[];
      if (accountIdsParam && typeof accountIdsParam === 'string') {
        accountIds = accountIdsParam.split(',').map(id => id.trim());
      } else {
        const accounts = this.accountRepository.findActiveByUserId(userId);
        accountIds = accounts.map((a) => a.id);
      }

      const distribution = this.analyticsService.calculateCategoryDistribution(accountIds, dateRange);

      res.status(200).json({ categories: distribution });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to calculate category distribution';
      this.logger.error('Category distribution error', { error: message });
      res.status(500).json({ error: message });
    }
  };
}