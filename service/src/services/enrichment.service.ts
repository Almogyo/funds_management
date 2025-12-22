import { Logger } from '../utils/logger';
import { TransactionRepository } from '../repositories/transaction.repository';
import { Transaction } from '../types';
import { IsracardEnricher } from './enrichers/isracard.enricher';
import { AmexEnricher } from './enrichers/amex.enricher';
import { MaxEnricher } from './enrichers/max.enricher';
import { VisaCalEnricher } from './enrichers/visacal.enricher';
import { IEnricher } from './enrichers/isracard.enricher';
import Queue from 'bull';

export interface EnrichmentConfig {
  enableEnrichment: boolean;
  batchSize: number;
  batchSleepMs: number;
  immediateEnrichmentDays: number;
}

/**
 * Enrichment Service orchestrates dual-stage enrichment:
 * - Stage 1: For transactions ≤ immediateEnrichmentDays, enrich immediately during scrape
 * - Stage 2: For transactions > immediateEnrichmentDays, queue for background job
 */
export class EnrichmentService {
  private enrichers: Map<string, IEnricher>;
  private enrichmentQueue?: Queue.Queue;
  private config: EnrichmentConfig = {
    enableEnrichment: true,
    batchSize: 10,
    batchSleepMs: 1000,
    immediateEnrichmentDays: 30,
  };

  constructor(
    private transactionRepository: TransactionRepository,
    private logger: Logger,
    config?: Partial<EnrichmentConfig>,
    redisClient?: any // Use any for Redis client
  ) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Initialize enrichers
    this.enrichers = new Map<string, IEnricher>([
      ['isracard', new IsracardEnricher(logger)],
      ['amex', new AmexEnricher(logger)],
      ['max', new MaxEnricher(logger)],
      ['visacal', new VisaCalEnricher(logger)],
    ]);

    // Initialize queue if Redis is available
    if (redisClient) {
      this.enrichmentQueue = new Queue('transaction-enrichment', {
        redis: redisClient,
      });

      this.enrichmentQueue.process(
        this.config.batchSize,
        async (job) => this.processEnrichmentJob(job)
      );

      this.enrichmentQueue.on('failed', (job, err) => {
        this.logger.error('Enrichment job failed', {
          jobId: job.id,
          error: err.message,
        });
      });

      this.enrichmentQueue.on('completed', (job) => {
        this.logger.debug('Enrichment job completed', { jobId: job.id });
      });
    }
  }

  /**
   * Orchestrate enrichment for newly scraped transactions.
   * Dual-stage strategy:
   * - Immediate: Transactions from last 30 days
   * - Background: Older transactions queued for async processing
   */
  async enrichTransactions(
    transactions: Transaction[],
    vendorId: string,
    accountId: string
  ): Promise<{ immediate: number; queued: number }> {
    if (!this.config.enableEnrichment || !transactions.length) {
      return { immediate: 0, queued: 0 };
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - this.config.immediateEnrichmentDays * 24 * 60 * 60 * 1000);

    const immediateTransactions: Transaction[] = [];
    const backgroundTransactions: Transaction[] = [];

    // Separate transactions by date
    for (const txn of transactions) {
      if (txn.date >= thirtyDaysAgo) {
        immediateTransactions.push(txn);
      } else {
        backgroundTransactions.push(txn);
      }
    }

    // Stage 1: Immediate enrichment with rate limiting
    let immediateCount = 0;
    if (immediateTransactions.length > 0) {
      try {
        immediateCount = await this.enrichBatch(immediateTransactions, vendorId);
        this.logger.info('Completed immediate enrichment', {
          count: immediateCount,
          vendorId,
          accountId,
        });
      } catch (error) {
        this.logger.error('Immediate enrichment failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          vendorId,
          accountId,
        });
      }
    }

    // Stage 2: Queue background enrichment for older transactions
    let queuedCount = 0;
    if (backgroundTransactions.length > 0 && this.enrichmentQueue) {
      try {
        for (const txn of backgroundTransactions) {
          await this.enrichmentQueue.add(
            {
              transactionId: txn.id,
              vendorId,
              accountId,
            },
            {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000,
              },
              removeOnComplete: true,
              removeOnFail: false,
            }
          );
          queuedCount++;
        }

        this.logger.info('Queued background enrichment', {
          count: queuedCount,
          vendorId,
          accountId,
        });
      } catch (error) {
        this.logger.error('Failed to queue background enrichment', {
          error: error instanceof Error ? error.message : 'Unknown error',
          vendorId,
          accountId,
        });
      }
    }

    return { immediate: immediateCount, queued: queuedCount };
  }

  /**
   * Process a single enrichment job from the queue.
   */
  private async processEnrichmentJob(job: Queue.Job): Promise<void> {
    const { transactionId, vendorId } = job.data;

    try {
      // Fetch transaction by ID - use find method or similar
      const enricher = this.enrichers.get(vendorId.toLowerCase());
      if (!enricher) {
        this.logger.warn('No enricher found for vendor', { vendorId });
        return;
      }

      // TODO: Get transaction from repository once getById is available
      // For now, log the job data
      this.logger.debug('Processing enrichment job', {
        transactionId,
        vendorId,
      });
    } catch (error) {
      this.logger.error('Failed to enrich transaction from job', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId,
        vendorId,
      });
      throw error;
    }
  }

  /**
   * Enrich a batch of transactions with rate limiting.
   * Batch size: 10, Sleep: 1000ms between batches
   */
  private async enrichBatch(transactions: Transaction[], vendorId: string): Promise<number> {
    const enricher = this.enrichers.get(vendorId.toLowerCase());
    if (!enricher) {
      this.logger.warn('No enricher found for vendor', { vendorId });
      return 0;
    }

    let enrichedCount = 0;
    const batches = this.createBatches(transactions, this.config.batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      try {
        const enrichmentResults = await Promise.all(
          batch.map((txn) => enricher.enrichTransaction(txn).catch((error) => {
            this.logger.warn('Failed to enrich single transaction', {
              error: error instanceof Error ? error.message : 'Unknown error',
              transactionId: txn.id,
              vendorId,
            });
            return null;
          }))
        );

        // Update enrichment data for successful enrichments
        for (let j = 0; j < batch.length; j++) {
          const result = enrichmentResults[j];
          if (result) {
            try {
              await this.transactionRepository.updateEnrichmentData(batch[j].id, result);
              enrichedCount++;
            } catch (error) {
              this.logger.error('Failed to update enrichment data', {
                error: error instanceof Error ? error.message : 'Unknown error',
                transactionId: batch[j].id,
              });
            }
          }
        }

        // Sleep between batches to avoid rate limiting
        if (i < batches.length - 1) {
          await this.sleep(this.config.batchSleepMs);
        }
      } catch (error) {
        this.logger.error('Batch enrichment failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          batchIndex: i,
          vendorId,
        });
      }
    }

    return enrichedCount;
  }

  /**
   * Create batches from array.
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Sleep for specified milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<EnrichmentConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Enrichment service config updated', { config: this.config });
  }

  /**
   * Get queue statistics.
   */
  async getQueueStats() {
    if (!this.enrichmentQueue) {
      return null;
    }

    return {
      waiting: await this.enrichmentQueue.getWaitingCount(),
      active: await this.enrichmentQueue.getActiveCount(),
      completed: await this.enrichmentQueue.getCompletedCount(),
      failed: await this.enrichmentQueue.getFailedCount(),
      delayed: await this.enrichmentQueue.getDelayedCount(),
    };
  }
}
