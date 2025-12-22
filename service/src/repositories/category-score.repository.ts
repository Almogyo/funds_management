import { Database } from 'better-sqlite3';
import { Logger } from '../utils/logger';
import { DescriptionMatchResult, VendorMatchResult } from '../services/fuzzy-matching.service';
import { CategorizationDecision } from '../services/categorize-decision.engine';
import { randomUUID } from 'crypto';

export interface CategorizationRecord {
  transactionId: string;
  accountId: string;
  vendorId: string;
  description: string;
  descriptionScores: DescriptionMatchResult[];
  vendorScore: VendorMatchResult | null;
  decision: CategorizationDecision;
  timestamp: Date;
}

export interface UserOverride {
  transactionId: string;
  previousMainCategoryId: string;
  newMainCategoryId: string;
  userId: string;
  reason?: string;
  timestamp: Date;
}

/**
 * Repository for storing and analyzing categorization scores.
 * Used for understanding system categorization quality and learning from user overrides.
 */
export class CategoryScoreRepository {
  constructor(private db: Database, private logger: Logger) {}

  /**
   * Record categorization scores for a transaction.
   * Stores detailed scoring information for audit and learning.
   */
  recordCategorization(record: CategorizationRecord): void {
    try {
      const id = randomUUID();
      const now = new Date();

      const stmt = this.db.prepare(`
        INSERT INTO category_scores (
          id,
          transaction_id,
          account_id,
          vendor_id,
          description,
          description_top_score,
          description_top_category_id,
          vendor_score,
          vendor_category_id,
          main_category_id,
          decision_source,
          decision_confidence,
          decision_reason,
          calculated_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        record.transactionId,
        record.accountId,
        record.vendorId,
        record.description,
        record.descriptionScores[0]?.final_score || 0,
        record.descriptionScores[0]?.categoryId || null,
        record.vendorScore?.final_score || 0,
        record.vendorScore?.categoryId || null,
        record.decision.mainCategoryId,
        record.decision.source,
        record.decision.confidence,
        record.decision.reason,
        record.timestamp.toISOString(),
        now.toISOString()
      );

      this.logger.debug('Recorded categorization scores', {
        transactionId: record.transactionId,
        source: record.decision.source,
      });
    } catch (error) {
      this.logger.error('Failed to record categorization scores', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId: record.transactionId,
      });
    }
  }

  /**
   * Record user override of category selection.
   */
  recordUserOverride(override: UserOverride): void {
    try {
      const id = randomUUID();

      const stmt = this.db.prepare(`
        INSERT INTO category_overrides (
          id,
          transaction_id,
          previous_main_category_id,
          new_main_category_id,
          user_id,
          reason,
          overridden_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        override.transactionId,
        override.previousMainCategoryId,
        override.newMainCategoryId,
        override.userId,
        override.reason || null,
        override.timestamp.toISOString(),
        new Date().toISOString()
      );

      this.logger.info('Recorded category override', {
        transactionId: override.transactionId,
        userId: override.userId,
        from: override.previousMainCategoryId,
        to: override.newMainCategoryId,
      });
    } catch (error) {
      this.logger.error('Failed to record category override', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId: override.transactionId,
      });
    }
  }

  /**
   * Get categorization analysis for learning purposes.
   */
  getCategorizationAnalytics(filters?: {
    vendorId?: string;
    source?: string;
    confidenceLevel?: string;
    startDate?: Date;
    endDate?: Date;
  }): any {
    let sql = 'SELECT * FROM category_scores WHERE 1=1';
    const params: any[] = [];

    if (filters?.vendorId) {
      sql += ' AND vendor_id = ?';
      params.push(filters.vendorId);
    }

    if (filters?.source) {
      sql += ' AND decision_source = ?';
      params.push(filters.source);
    }

    if (filters?.confidenceLevel) {
      sql += ' AND decision_confidence = ?';
      params.push(filters.confidenceLevel);
    }

    if (filters?.startDate) {
      sql += ' AND calculated_at >= ?';
      params.push(filters.startDate.toISOString());
    }

    if (filters?.endDate) {
      sql += ' AND calculated_at <= ?';
      params.push(filters.endDate.toISOString());
    }

    sql += ' ORDER BY calculated_at DESC LIMIT 10000';

    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Analyze override patterns to identify system weaknesses.
   */
  getOverridePatterns(): any {
    const sql = `
      SELECT 
        cs.description_top_category_id as system_choice,
        co.new_main_category_id as user_choice,
        COUNT(*) as override_count,
        ROUND(AVG(cs.description_top_score), 2) as avg_system_score
      FROM category_scores cs
      INNER JOIN category_overrides co ON cs.transaction_id = co.transaction_id
      WHERE co.previous_main_category_id = cs.main_category_id
      GROUP BY cs.description_top_category_id, co.new_main_category_id
      ORDER BY override_count DESC
      LIMIT 50
    `;

    const stmt = this.db.prepare(sql);
    return stmt.all();
  }
}
