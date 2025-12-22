import { Logger } from '../../utils/logger';
import { Transaction } from '../../types';

export interface EnrichmentData {
  [key: string]: any;
}

/**
 * Base enricher interface for all vendors.
 */
export interface IEnricher {
  enrichTransaction(transaction: Transaction): Promise<EnrichmentData>;
}

/**
 * Isracard Enricher - adds sector classification from secondary API call.
 * Uses PirteyIska_204 endpoint to fetch merchant sector.
 */
export class IsracardEnricher implements IEnricher {
  constructor(private logger: Logger) {}

  async enrichTransaction(transaction: Transaction): Promise<EnrichmentData> {
    try {
      // Extract identifier from transaction for sector lookup
      const identifier = this.extractIdentifier(transaction);
      if (!identifier) {
        this.logger.debug('No identifier found for Isracard transaction', {
          transactionId: transaction.id,
        });
        return { sector: null };
      }

      // In production: Call PirteyIska_204 endpoint
      // For now: Return placeholder
      const sector = await this.fetchSector(identifier);

      return {
        sector,
        identifier,
        enrichedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Isracard enrichment failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId: transaction.id,
      });
      return { sector: null, error: 'Enrichment failed' };
    }
  }

  /**
   * Extract transaction identifier from Isracard transaction.
   */
  private extractIdentifier(transaction: Transaction): string | null {
    try {
      const json = JSON.parse(transaction.rawJson);
      // Isracard transactions have specific fields
      // This depends on the actual scrapers library output
      return json.identifier || json.id || null;
    } catch (error) {
      this.logger.warn('Failed to parse Isracard transaction JSON', {
        transactionId: transaction.id,
      });
      return null;
    }
  }

  /**
   * Fetch sector from Isracard secondary API.
   * In production, this would call the PirteyIska_204 endpoint.
   */
  private async fetchSector(identifier: string): Promise<string | null> {
    // TODO: Implement actual API call to PirteyIska_204
    // For now, return null as placeholder
    return null;
  }
}

/**
 * Amex Enricher - same as Isracard (shared base scraper).
 */
export class AmexEnricher implements IEnricher {
  private isracardEnricher: IsracardEnricher;

  constructor(private logger: Logger) {
    this.isracardEnricher = new IsracardEnricher(logger);
  }

  async enrichTransaction(transaction: Transaction): Promise<EnrichmentData> {
    // Amex uses same enrichment as Isracard
    return this.isracardEnricher.enrichTransaction(transaction);
  }
}

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
