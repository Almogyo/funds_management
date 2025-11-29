import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { LogReaderService } from '../services/log-reader.service';
import { Logger } from '../utils/logger';

export class LogsController {
  constructor(
    private logReaderService: LogReaderService,
    private logger: Logger
  ) {}

  /**
   * @swagger
   * /api/logs:
   *   get:
   *     tags: [Logs]
   *     summary: Get application logs
   *     description: Retrieve recent application logs with optional filtering
   *     security:
   *       - SessionAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 100
   *         description: Number of log entries to return
   *       - in: query
   *         name: level
   *         schema:
   *           type: string
   *           enum: [error, warn, info, debug]
   *         description: Filter by log level
   *       - in: query
   *         name: since
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Return logs since this timestamp (for polling)
   *     responses:
   *       200:
   *         description: List of log entries
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 logs:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       timestamp:
   *                         type: string
   *                       level:
   *                         type: string
   *                       message:
   *                         type: string
   *                       context:
   *                         type: string
   *                 count:
   *                   type: integer
   *       401:
   *         description: Authentication required
   */
  getLogs = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const level = req.query.level as string | undefined;
      const since = req.query.since as string | undefined;

      let logs;
      if (since) {
        logs = await this.logReaderService.tailLogs(since);
      } else {
        logs = await this.logReaderService.getRecentLogs(limit, level);
      }

      res.status(200).json({
        logs,
        count: logs.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch logs';
      this.logger.error('Get logs error', { error: message });
      res.status(500).json({ error: message });
    }
  };

  /**
   * @swagger
   * /api/logs/stats:
   *   get:
   *     tags: [Logs]
   *     summary: Get log file statistics
   *     security:
   *       - SessionAuth: []
   *     responses:
   *       200:
   *         description: Log file statistics
   *       401:
   *         description: Authentication required
   */
  getLogStats = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const stats = this.logReaderService.getLogStats();

      res.status(200).json(stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch log stats';
      this.logger.error('Get log stats error', { error: message });
      res.status(500).json({ error: message });
    }
  };
}