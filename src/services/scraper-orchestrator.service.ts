import { ScraperService, ScraperOptions } from './scraper.service';
import { CredentialService } from './credential.service';
import { TransactionProcessorService } from './transaction-processor.service';
import { CategorizationService } from './categorization.service';
import { Logger } from '../utils/logger';
import { AccountRepository } from '../repositories/account.repository';
import { CredentialRepository } from '../repositories/credential.repository';
import { TransactionRepository } from '../repositories/transaction.repository';
import { CategoryRepository } from '../repositories/category.repository';
import { randomUUID } from 'crypto';

export interface ScraperJob {
  id: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date | null;
  completedAt: Date | null;
  accountsToScrape: string[];
  results: JobResult[];
  error: string | null;
}

export interface JobResult {
  accountId: string;
  accountName: string;
  companyId: string;
  success: boolean;
  transactionsCount: number;
  error: string | null;
  duration: number;
}

export class ScraperOrchestratorService {
  private transactionProcessor: TransactionProcessorService;
  private categorizationService: CategorizationService;

  constructor(
    private scraperService: ScraperService,
    private credentialService: CredentialService,
    private accountRepository: AccountRepository,
    private credentialRepository: CredentialRepository,
    private transactionRepository: TransactionRepository,
    private categoryRepository: CategoryRepository,
    private logger: Logger
  ) {
    this.transactionProcessor = new TransactionProcessorService(this.logger);
    this.categorizationService = new CategorizationService(this.logger, this.categoryRepository);
    this.categorizationService.ensureUnknownCategory();
  }

  async createJob(userId: string, accountIds: string[]): Promise<ScraperJob> {
    const job: ScraperJob = {
      id: randomUUID(),
      userId,
      status: 'pending',
      startedAt: null,
      completedAt: null,
      accountsToScrape: accountIds,
      results: [],
      error: null,
    };

    this.logger.info(`Scraper job created`, {
      jobId: job.id,
      userId,
      accountCount: accountIds.length,
    });

    return job;
  }

  async executeJob(
    job: ScraperJob,
    options: ScraperOptions,
    maxParallel: number = 2
  ): Promise<ScraperJob> {
    job.status = 'running';
    job.startedAt = new Date();

    this.logger.scraperLog(`Job execution started`, 'JOB', {
      jobId: job.id,
      userId: job.userId,
      accountCount: job.accountsToScrape.length,
    });

    try {
      const accountsToScrape: Array<{
        accountId: string;
        accountName: string;
        companyId: string;
        credentials: any;
      }> = [];

      for (const accountId of job.accountsToScrape) {
        const account = this.accountRepository.findById(accountId);
        if (!account) {
          this.logger.warn(`Account not found for scraping`, {
            jobId: job.id,
            accountId,
          });
          job.results.push({
            accountId,
            accountName: 'Unknown',
            companyId: 'unknown',
            success: false,
            transactionsCount: 0,
            error: 'Account not found',
            duration: 0,
          });
          continue;
        }

        if (!account.active) {
          this.logger.warn(`Account is inactive, skipping`, {
            jobId: job.id,
            accountId,
          });
          job.results.push({
            accountId,
            accountName: account.alias,
            companyId: account.companyId,
            success: false,
            transactionsCount: 0,
            error: 'Account is inactive',
            duration: 0,
          });
          continue;
        }

        const credential = this.credentialRepository.findByUserIdAndAccountName(
          job.userId,
          account.alias
        );

        if (!credential) {
          this.logger.warn(`Credentials not found for account`, {
            jobId: job.id,
            accountId,
            accountName: account.alias,
          });
          job.results.push({
            accountId,
            accountName: account.alias,
            companyId: account.companyId,
            success: false,
            transactionsCount: 0,
            error: 'Credentials not found',
            duration: 0,
          });
          continue;
        }

        const decryptedCredentials = this.credentialService.retrieveCredentials(credential);

        accountsToScrape.push({
          accountId,
          accountName: account.alias,
          companyId: account.companyId,
          credentials: decryptedCredentials,
        });
      }

      if (accountsToScrape.length === 0) {
        job.status = 'failed';
        job.error = 'No valid accounts to scrape';
        job.completedAt = new Date();
        this.logger.scraperLog(`Job failed: no valid accounts`, 'JOB', {
          jobId: job.id,
        });
        return job;
      }

      const scraperResults = await this.scraperService.scrapeMultiple(
        accountsToScrape.map((a) => ({
          companyId: a.companyId,
          accountName: a.accountName,
          credentials: a.credentials,
        })),
        options,
        maxParallel
      );

      for (let i = 0; i < accountsToScrape.length; i++) {
        const account = accountsToScrape[i];
        const result = scraperResults[i];

        let savedTransactionsCount = 0;

        if (result.success && result.transactions.length > 0) {
          this.logger.scraperLog('Processing scraped transactions', account.accountName, {
            rawTransactionsCount: result.transactions.length,
          });

          const processedTransactions = this.transactionProcessor.processTransactions(
            result.transactions,
            account.accountId
          );

          this.logger.calculationLog('Processed transactions', {
            accountName: account.accountName,
            processedCount: processedTransactions.length,
          });

          for (const txn of processedTransactions) {
            const existingTxn = this.transactionRepository.findByHash(
              account.accountId,
              txn.txnHash
            );
            if (!existingTxn) {
              const category = this.categorizationService.categorizeTransaction(txn.description);

              this.transactionRepository.create(
                account.accountId,
                txn.txnHash,
                txn.date,
                txn.processedDate,
                txn.amount,
                txn.currency,
                txn.description,
                txn.status,
                category,
                txn.installmentNumber !== null && txn.installmentTotal !== null
                  ? { number: txn.installmentNumber, total: txn.installmentTotal }
                  : null,
                txn.rawJson
              );
              savedTransactionsCount++;
            }
          }

          this.logger.scraperLog('Saved transactions to database', account.accountName, {
            totalTransactions: result.transactions.length,
            newTransactions: savedTransactionsCount,
            duplicatesSkipped: processedTransactions.length - savedTransactionsCount,
          });

          this.accountRepository.updateLastScrapedAt(account.accountId);
        }

        job.results.push({
          accountId: account.accountId,
          accountName: account.accountName,
          companyId: account.companyId,
          success: result.success,
          transactionsCount: savedTransactionsCount,
          error: result.error || null,
          duration: result.duration,
        });
      }

      const allSuccessful = job.results.every((r) => r.success);
      job.status = allSuccessful ? 'completed' : 'failed';
      job.completedAt = new Date();

      if (!allSuccessful) {
        const failedAccounts = job.results.filter((r) => !r.success);
        job.error = `Failed to scrape ${failedAccounts.length} account(s)`;
      }

      this.logger.scraperLog(`Job execution completed`, 'JOB', {
        jobId: job.id,
        status: job.status,
        successCount: job.results.filter((r) => r.success).length,
        failCount: job.results.filter((r) => !r.success).length,
        totalTransactions: job.results.reduce((sum, r) => sum + r.transactionsCount, 0),
        duration: `${job.completedAt.getTime() - job.startedAt!.getTime()}ms`,
      });

      return job;
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date();

      this.logger.error(`Job execution failed with exception`, {
        jobId: job.id,
        error: job.error,
      });

      return job;
    }
  }

  async scrapeActiveAccounts(
    userId: string,
    options: ScraperOptions,
    maxParallel: number = 2
  ): Promise<ScraperJob> {
    const activeAccounts = this.accountRepository.findActiveByUserId(userId);

    if (activeAccounts.length === 0) {
      this.logger.warn(`No active accounts found for user`, { userId });
      throw new Error('No active accounts found');
    }

    const accountIds = activeAccounts.map((a) => a.id);
    const job = await this.createJob(userId, accountIds);

    return this.executeJob(job, options, maxParallel);
  }
}
