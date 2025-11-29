import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { Logger } from './utils/logger';
import { DatabaseService } from './database/database.service';
import { ConfigService } from './config/config.service';
import { initializeLogger } from './utils/logger';
import { swaggerSpec } from './config/swagger.config';

import { UserRepository } from './repositories/user.repository';
import { CredentialRepository } from './repositories/credential.repository';
import { AccountRepository } from './repositories/account.repository';
import { TransactionRepository } from './repositories/transaction.repository';
import { CategoryRepository } from './repositories/category.repository';

import { AuthService } from './services/auth.service';
import { CredentialService } from './services/credential.service';
import { AnalyticsService } from './services/analytics.service';
import { ScraperService } from './services/scraper.service';
import { ScraperOrchestratorService } from './services/scraper-orchestrator.service';

import { AuthController } from './controllers/auth.controller';
import { AccountController } from './controllers/account.controller';
import { TransactionController } from './controllers/transaction.controller';
import { AnalyticsController } from './controllers/analytics.controller';
import { ScraperController } from './controllers/scraper.controller';

import { createAuthMiddleware } from './middleware/auth.middleware';

export class App {
  public app: Application;
  private logger: Logger;
  private dbService: DatabaseService;
  private config: ConfigService;

  constructor(configPath?: string) {
    this.config = new ConfigService(configPath);
    this.logger = initializeLogger(this.config.logging);
    this.dbService = new DatabaseService(
      this.config.database.path,
      this.config.database.enableWAL,
      this.config.database.enableForeignKeys
    );

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();

    this.logger.info('Application initialized', {
      env: this.config.server.env,
      port: this.config.server.port,
    });
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    const limiter = rateLimit({
      windowMs: this.config.security.rateLimitWindowMs,
      max: this.config.security.rateLimitMaxRequests,
      message: 'Too many requests, please try again later',
    });
    this.app.use(limiter);

    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.logger.apiLog(req.method, req.path, res.statusCode, duration);
      });
      next();
    });
  }

  private setupRoutes(): void {
    const db = this.dbService.getDatabase();

    const userRepo = new UserRepository(db);
    const credentialRepo = new CredentialRepository(db);
    const accountRepo = new AccountRepository(db);
    const transactionRepo = new TransactionRepository(db);
    const categoryRepo = new CategoryRepository(db);

    const authService = new AuthService(this.logger, userRepo);
    const credentialService = new CredentialService(this.config.security.encryptionKey);
    const analyticsService = new AnalyticsService(this.logger, transactionRepo);
    const scraperService = new ScraperService(this.logger, this.config.scraping.screenshotPath);
    const scraperOrchestrator = new ScraperOrchestratorService(
      scraperService,
      credentialService,
      accountRepo,
      credentialRepo,
      transactionRepo,
      categoryRepo,
      this.logger
    );

    const authController = new AuthController(authService, this.logger);
    const accountController = new AccountController(
      accountRepo,
      credentialRepo,
      credentialService,
      this.logger
    );
    const transactionController = new TransactionController(
      transactionRepo,
      accountRepo,
      this.logger
    );
    const analyticsController = new AnalyticsController(analyticsService, accountRepo, this.logger);
    const scraperController = new ScraperController(scraperOrchestrator, this.logger);

    const authMiddleware = createAuthMiddleware(authService, this.logger);

    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

    this.app.get('/health', (_req: Request, res: Response) => {
      const dbHealthy = this.dbService.healthCheck();
      res.status(dbHealthy ? 200 : 503).json({
        status: dbHealthy ? 'healthy' : 'unhealthy',
        database: dbHealthy ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
      });
    });

    this.app.post('/api/auth/register', authController.register);
    this.app.post('/api/auth/login', authController.login);
    this.app.post('/api/auth/logout', authController.logout);
    this.app.post('/api/auth/change-password', authMiddleware, authController.changePassword);

    this.app.get('/api/accounts', authMiddleware, accountController.getAccounts);
    this.app.post('/api/accounts/:companyId', authMiddleware, accountController.createAccount);
    this.app.put('/api/accounts/:id', authMiddleware, accountController.updateAccount);
    this.app.delete('/api/accounts/:id', authMiddleware, accountController.deleteAccount);

    this.app.get('/api/transactions', authMiddleware, transactionController.getTransactions);
    this.app.get('/api/transactions/:id', authMiddleware, transactionController.getTransaction);
    this.app.put(
      '/api/transactions/:id/category',
      authMiddleware,
      transactionController.updateCategory
    );

    this.app.get('/api/analytics/summary', authMiddleware, analyticsController.getSummary);
    this.app.get(
      '/api/analytics/highest-expense',
      authMiddleware,
      analyticsController.getHighestExpense
    );
    this.app.get(
      '/api/analytics/recurring-payments',
      authMiddleware,
      analyticsController.getRecurringPayments
    );
    this.app.get('/api/analytics/trends', authMiddleware, analyticsController.getTrends);
    this.app.get(
      '/api/analytics/category-distribution',
      authMiddleware,
      analyticsController.getCategoryDistribution
    );

    this.app.post('/api/scrape', authMiddleware, scraperController.scrapeAccounts);

    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({ error: 'Route not found' });
    });
  }

  private setupErrorHandling(): void {
    this.app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
      this.logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
      });

      res.status(500).json({
        error: 'Internal server error',
        message: this.config.server.env === 'development' ? err.message : undefined,
      });
    });
  }

  public listen(): void {
    const port = this.config.server.port;
    const host = this.config.server.host;

    this.app.listen(port, host, () => {
      this.logger.info(`Server started`, {
        host,
        port,
        env: this.config.server.env,
      });
    });
  }

  public close(): void {
    this.dbService.close();
    this.logger.info('Application shut down');
  }
}
