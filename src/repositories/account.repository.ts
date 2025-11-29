import { Database } from 'better-sqlite3';
import { Account } from '../types';
import { randomUUID } from 'crypto';

export class AccountRepository {
  constructor(private db: Database) {}

  create(
    userId: string,
    accountNumber: string,
    companyId: string,
    alias: string,
    active = true
  ): Account {
    const id = randomUUID();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO accounts (id, user_id, account_number, company_id, alias, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, userId, accountNumber, companyId, alias, active ? 1 : 0, now, now);

    return {
      id,
      userId,
      accountNumber,
      companyId,
      alias,
      active,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  findById(id: string): Account | null {
    const stmt = this.db.prepare(`
      SELECT id, user_id, account_number, company_id, alias, active, created_at, updated_at
      FROM accounts
      WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    return row ? this.mapToAccount(row) : null;
  }

  findByUserId(userId: string): Account[] {
    const stmt = this.db.prepare(`
      SELECT id, user_id, account_number, company_id, alias, active, created_at, updated_at
      FROM accounts
      WHERE user_id = ?
      ORDER BY alias
    `);

    const rows = stmt.all(userId) as any[];
    return rows.map((row) => this.mapToAccount(row));
  }

  findActiveByUserId(userId: string): Account[] {
    const stmt = this.db.prepare(`
      SELECT id, user_id, account_number, company_id, alias, active, created_at, updated_at
      FROM accounts
      WHERE user_id = ? AND active = 1
      ORDER BY alias
    `);

    const rows = stmt.all(userId) as any[];
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

  deleteByUserId(userId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM accounts WHERE user_id = ?
    `);

    stmt.run(userId);
  }

  private mapToAccount(row: any): Account {
    return {
      id: row.id,
      userId: row.user_id,
      accountNumber: row.account_number,
      companyId: row.company_id,
      alias: row.alias,
      active: row.active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}