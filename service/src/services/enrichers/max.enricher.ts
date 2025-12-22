import { Logger } from '../../utils/logger';
import { Transaction } from '../../types';
import { IEnricher, EnrichmentData } from './isracard.enricher';

/**
 * Max Enricher - adds direct enrichment fields from scrape response.
 * Enriches with categoryId, arn, planTypeId.
 */
export class MaxEnricher implements IEnricher {
  constructor(private logger: Logger) {}

  async enrichTransaction(transaction: Transaction): Promise<EnrichmentData> {
    try {
      const json = JSON.parse(transaction.rawJson);

      return {
        maxCategoryId: json.categoryId || null,
        arn: json.arn || null,
        planTypeId: json.planTypeId || null,
        enrichedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Max enrichment failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId: transaction.id,
      });
      return { error: 'Enrichment failed' };
    }
  }
}
