import { Database } from 'better-sqlite3';
import { Transaction, InstallmentInfo } from '../types';
import { randomUUID } from 'crypto';
import { TransactionCategoryRepository } from './transaction-category.repository';

export interface TransactionFilters {
  accountIds?: string[];
  startDate?: Date;
  endDate?: Date;
  categories?: string[];
  status?: 'completed' | 'pending';
  minAmount?: number;
  maxAmount?: number;
}

export class TransactionRepository {
  constructor(
    private db: Database,
    private transactionCategoryRepository: TransactionCategoryRepository
  ) {}

  create(
    accountId: string,
    txnHash: string,
    date: Date,
    processedDate: Date,
    amount: number,
    currency: string,
    description: string,
    status: 'completed' | 'pending',
    installmentInfo: InstallmentInfo | null,
    rawJson: string
  ): Transaction {
    const id = randomUUID();
    const createdAt = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO transactions (
        id, account_id, txn_hash, date, processed_date, amount, currency,
        description, status, installment_number, installment_total,
        raw_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      accountId,
      txnHash,
      date.getTime(),
      processedDate.getTime(),
      amount,
      currency,
      description,
      status,
      installmentInfo?.number || null,
      installmentInfo?.total || null,
      rawJson,
      createdAt
    );

    return {
      id,
      accountId,
      txnHash,
      date,
      processedDate,
      amount,
      currency,
      description,
      categories: [],
      status,
      installmentInfo,
      rawJson,
      createdAt: new Date(createdAt),
    };
  }

  findById(id: string): Transaction | null {
    const stmt = this.db.prepare(`
      SELECT * FROM transactions WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    return row ? this.mapToTransaction(row) : null;
  }

  findByHash(accountId: string, txnHash: string): Transaction | null {
    const stmt = this.db.prepare(`
      SELECT * FROM transactions WHERE account_id = ? AND txn_hash = ?
    `);

    const row = stmt.get(accountId, txnHash) as any;
    return row ? this.mapToTransaction(row) : null;
  }

  findByAccountId(accountId: string, limit?: number, offset?: number): Transaction[] {
    let query = `SELECT * FROM transactions WHERE account_id = ? ORDER BY date DESC`;

    if (limit !== undefined) {
      query += ` LIMIT ${limit}`;
      if (offset !== undefined) {
        query += ` OFFSET ${offset}`;
      }
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(accountId) as any[];
    return rows.map((row) => this.mapToTransaction(row));
  }

  findWithFilters(filters: TransactionFilters, limit?: number, offset?: number): Transaction[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.accountIds && filters.accountIds.length > 0) {
      const placeholders = filters.accountIds.map(() => '?').join(',');
      conditions.push(`account_id IN (${placeholders})`);
      params.push(...filters.accountIds);
    }

    if (filters.startDate) {
      conditions.push('date >= ?');
      params.push(filters.startDate.getTime());
    }

    if (filters.endDate) {
      conditions.push('date <= ?');
      params.push(filters.endDate.getTime());
    }

    if (filters.categories && filters.categories.length > 0) {
      // Filter by categories using junction table
      const placeholders = filters.categories.map(() => '?').join(',');
      conditions.push(`
        id IN (
          SELECT DISTINCT transaction_id 
          FROM transaction_categories tc
          JOIN categories c ON tc.category_id = c.id
          WHERE c.name IN (${placeholders})
        )
      `);
      params.push(...filters.categories);
    }

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.minAmount !== undefined) {
      conditions.push('amount >= ?');
      params.push(filters.minAmount);
    }

    if (filters.maxAmount !== undefined) {
      conditions.push('amount <= ?');
      params.push(filters.maxAmount);
    }

    let query = 'SELECT * FROM transactions';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY date DESC';

    if (limit !== undefined) {
      query += ` LIMIT ${limit}`;
      if (offset !== undefined) {
        query += ` OFFSET ${offset}`;
      }
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map((row) => this.mapToTransaction(row));
  }

  delete(id: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM transactions WHERE id = ?
    `);

    stmt.run(id);
  }

  deleteByAccountId(accountId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM transactions WHERE account_id = ?
    `);

    stmt.run(accountId);
  }

  countByAccountId(accountId: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM transactions WHERE account_id = ?
    `);

    const result = stmt.get(accountId) as { count: number };
    return result.count;
  }

  getTotalsByCategory(accountIds: string[], startDate?: Date, endDate?: Date): Array<{ category: string; total: number; count: number }> {
    const conditions: string[] = [];
    const params: any[] = [];

    // Only expenses (negative amounts)
    conditions.push('t.amount < 0');

    // Only main categories (is_main = 1) for analytics to avoid duplicates
    conditions.push('tc.is_main = 1');

    if (accountIds.length > 0) {
      const placeholders = accountIds.map(() => '?').join(',');
      conditions.push(`t.account_id IN (${placeholders})`);
      params.push(...accountIds);
    }

    if (startDate) {
      conditions.push('t.date >= ?');
      params.push(startDate.getTime());
    }

    if (endDate) {
      conditions.push('t.date <= ?');
      params.push(endDate.getTime());
    }

    const whereClause = ' WHERE ' + conditions.join(' AND ');

    // Query that groups transactions by main category using the junction table
    // Only includes categories marked as is_main = 1 to avoid duplicate counting
    // Each transaction is counted only once, under its main category
    const query = `
      SELECT c.name as category, SUM(t.amount) as total, COUNT(DISTINCT t.id) as count
      FROM transactions t
      JOIN transaction_categories tc ON t.id = tc.transaction_id
      JOIN categories c ON tc.category_id = c.id
      ${whereClause}
      GROUP BY c.id, c.name
      ORDER BY total ASC
    `;

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as Array<{ category: string; total: number; count: number }>;
  }

  private mapToTransaction(row: any): Transaction {
    const installmentInfo: InstallmentInfo | null =
      row.installment_number && row.installment_total
        ? {
            number: row.installment_number,
            total: row.installment_total,
          }
        : null;

    return {
      id: row.id,
      accountId: row.account_id,
      txnHash: row.txn_hash,
      date: new Date(row.date),
      processedDate: new Date(row.processed_date),
      amount: row.amount,
      currency: row.currency,
      description: row.description,
      categories: this.transactionCategoryRepository.getByTransactionId(row.id),
      status: row.status,
      installmentInfo,
      rawJson: row.raw_json,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Get all transactions with their descriptions for re-categorization
   */
  getAllTransactionDescriptions(): Array<{ id: string; description: string }> {
    const stmt = this.db.prepare(`
      SELECT id, description FROM transactions ORDER BY created_at DESC
    `);

    return stmt.all() as Array<{ id: string; description: string }>;
  }
}