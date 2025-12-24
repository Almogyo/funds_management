import { Logger } from '../../utils/logger';
import { Transaction } from '../../types';
import { IEnricher, EnrichmentData } from './isracard.enricher';
import { IsracardEnricher } from './isracard.enricher';

/**
 * Amex Enricher - same as Isracard (shared base scraper).
 */
export class AmexEnricher implements IEnricher {
  private isracardEnricher: IsracardEnricher;

  constructor(_logger: Logger) {
    this.isracardEnricher = new IsracardEnricher(_logger);
  }

  async enrichTransaction(transaction: Transaction): Promise<EnrichmentData> {
    // Amex uses same enrichment as Isracard
    return this.isracardEnricher.enrichTransaction(transaction);
  }
}
