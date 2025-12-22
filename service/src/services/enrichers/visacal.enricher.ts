import { Logger } from '../../utils/logger';
import { Transaction } from '../../types';
import { IEnricher, EnrichmentData } from './isracard.enricher';

/**
 * Visa Cal Enricher - adds merchant metadata.
 * Enriches with merchantID, address, phone, branchCode.
 */
export class VisaCalEnricher implements IEnricher {
  constructor(private logger: Logger) {}

  async enrichTransaction(transaction: Transaction): Promise<EnrichmentData> {
    try {
      const json = JSON.parse(transaction.rawJson);

      const merchantMetadata = {
        merchantID: json.merchantID || null,
        address: json.merchantAddress || null,
        phone: json.merchantPhone || null,
        branchCode: json.branchCode || null,
      };

      return {
        merchantMetadata,
        enrichedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Visa Cal enrichment failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId: transaction.id,
      });
      return { error: 'Enrichment failed' };
    }
  }
}
