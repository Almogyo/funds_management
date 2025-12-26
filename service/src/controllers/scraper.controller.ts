import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { ScraperOrchestratorService } from '../services/scraper-orchestrator.service';
import { Logger } from '../utils/logger';

export class ScraperController {
  constructor(
    private scraperOrchestrator: ScraperOrchestratorService,
    private logger: Logger
  ) {}

  /**
   * @swagger
   * /api/scrape:
   *   post:
   *     tags: [Scraping]
   *     summary: Scrape transactions from financial accounts
   *     description: Initiate transaction scraping from Israeli banks and credit card companies. Automatically saves new transactions to database with categorization.
   *     security:
   *       - SessionAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - startDate
   *             properties:
   *               accountIds:
   *                 type: array
   *                 items:
   *                   type: string
   *                   format: uuid
   *                 description: Account IDs to scrape (optional - defaults to all active accounts)
   *                 example: ["uuid-1", "uuid-2"]
   *               startDate:
   *                 type: string
   *                 format: date
   *                 description: Start date for transaction retrieval
   *                 example: "2025-01-01"
   *               endDate:
   *                 type: string
   *                 format: date
   *                 description: End date (optional - defaults to today)
   *                 example: "2025-11-29"
   *     responses:
   *       200:
   *         description: Scraping completed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 job:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     status:
   *                       type: string
   *                       enum: [completed, failed]
   *                     results:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           accountId:
   *                             type: string
   *                           accountName:
   *                             type: string
   *                           companyId:
   *                             type: string
   *                             enum: [hapoalim, leumi, discount, mizrahi, union, massad, visaCal, max, isracard, amex]
   *                           success:
   *                             type: boolean
   *                           transactionsCount:
   *                             type: integer
   *                           error:
   *                             type: string
   *                             nullable: true
   *       400:
   *         description: Invalid input
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Scraping failed
   */
  scrapeAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { startDate, endDate, accountIds } = req.body;

      if (!startDate) {
        res.status(400).json({ error: 'Start date is required' });
        return;
      }

      const options = {
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : new Date(),
        timeout: 180000, // 3 minutes - increased for credit card scrapers that need more time for navigation
        showBrowser: true,
      };

      let job;
      if (accountIds && accountIds.length > 0) {
        job = await this.scraperOrchestrator.createJob(userId, accountIds);
        job = await this.scraperOrchestrator.executeJob(job, options);
      } else {
        job = await this.scraperOrchestrator.scrapeActiveAccounts(userId, options);
      }

      res.status(200).json({
        message: 'Scraping job completed',
        job: {
          id: job.id,
          status: job.status,
          results: job.results,
          error: job.error,
          duration: job.completedAt && job.startedAt
            ? job.completedAt.getTime() - job.startedAt.getTime()
            : 0,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scraping failed';
      this.logger.error('Scraping error', { error: message });
      res.status(500).json({ error: message });
    }
  };
}