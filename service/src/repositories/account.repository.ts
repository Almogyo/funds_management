import { Database } from 'better-sqlite3';
import { Account } from '../types';
import { randomUUID } from 'crypto';

export class AccountRepository {
  constructor(private db: Database) {}

  create(
    userId: string,
    identifier: string,
    companyId: string,
    alias: string,
    active = true,
    card6Digits: string | null = null,
  ): Account {
    const id = randomUUID();
    const now = Date.now();
    const accountType = this.getAccountType(companyId);

    const stmt = this.db.prepare(`
      INSERT INTO accounts (id, user_id, account_number, company_id, alias, active, account_type, card_6_digits, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, userId, identifier, companyId, alias, active ? 1 : 0, accountType, card6Digits, now, now);

    return {
      id,
      userId,
      accountNumber: identifier,
      companyId,
      alias,
      active,
      accountType,
      card6Digits,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  findById(id: string): Account | null {
    const stmt = this.db.prepare(`
      SELECT id, user_id, account_number, card_6_digits, company_id, alias, active, account_type, created_at, updated_at, last_scraped_at
      FROM accounts
      WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    return row ? this.mapToAccount(row) : null;
  }

  findByUserId(userId: string): Account[] {
    const stmt = this.db.prepare(`
      SELECT id, user_id, account_number, card_6_digits, company_id, alias, active, account_type, created_at, updated_at, last_scraped_at
      FROM accounts
      WHERE user_id = ?
      ORDER BY alias
    `);

    const rows = stmt.all(userId) as any[];
    return rows.map((row) => this.mapToAccount(row));
  }

  findActiveByUserId(userId: string): Account[] {
    const stmt = this.db.prepare(`
      SELECT id, user_id, account_number, card_6_digits, company_id, alias, active, account_type, created_at, updated_at, last_scraped_at
      FROM accounts
      WHERE user_id = ? AND active = 1
      ORDER BY alias
    `);

    const rows = stmt.all(userId) as any[];
    return rows.map((row) => this.mapToAccount(row));
  }

  findMultipleById(ids: string[]): Account[] {
    if (ids.length === 0) return [];
    
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT id, user_id, account_number, card_6_digits, company_id, alias, active, account_type, created_at, updated_at, last_scraped_at
      FROM accounts
      WHERE id IN (${placeholders})
    `);

    const rows = stmt.all(...ids) as any[];
    return rows.map((row) => this.mapToAccount(row));
  }

  update(id: string, updates: { alias?: string; active?: boolean }): void {
    const updatedAt = Date.now();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.alias !== undefined) {
      fields.push('alias = ?');
      values.push(updates.alias);
    }

    if (updates.active !== undefined) {
      fields.push('active = ?');
      values.push(updates.active ? 1 : 0);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    values.push(updatedAt, id);

    const stmt = this.db.prepare(`
      UPDATE accounts
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
  }

  delete(id: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM accounts WHERE id = ?
    `);

    stmt.run(id);
  }

  updateLastScrapedAt(id: string): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE accounts
      SET last_scraped_at = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(now, now, id);
  }

  deleteByUserId(userId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM accounts WHERE user_id = ?
    `);

    stmt.run(userId);
  }

  private getAccountType(companyId: string): 'bank' | 'credit' {
    const creditCompanies = ['visaCal', 'max', 'isracard', 'amex'];
    return creditCompanies.includes(companyId) ? 'credit' : 'bank';
  }

  private mapToAccount(row: any): Account {
    return {
      id: row.id,
      userId: row.user_id,
      accountNumber: row.account_number,
      card6Digits: row.card_6_digits,
      companyId: row.company_id,
      alias: row.alias,
      active: row.active === 1,
      accountType: row.account_type || this.getAccountType(row.company_id),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastScrapedAt: row.last_scraped_at ? new Date(row.last_scraped_at) : undefined,
    };
  }
}