import { Database } from 'better-sqlite3';
import { EncryptedCredential } from '../types';
import { randomUUID } from 'crypto';

export class CredentialRepository {
  constructor(private db: Database) {}

  create(
    userId: string,
    accountName: string,
    companyId: string,
    encryptedData: string,
    iv: string,
    salt: string
  ): EncryptedCredential {
    const id = randomUUID();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO credentials (id, user_id, account_name, company_id, encrypted_data, iv, salt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, userId, accountName, companyId, encryptedData, iv, salt, now, now);

    return {
      id,
      userId,
      accountName,
      companyId,
      encryptedData,
      iv,
      salt,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  findById(id: string): EncryptedCredential | null {
    const stmt = this.db.prepare(`
      SELECT id, user_id, account_name, company_id, encrypted_data, iv, salt, created_at, updated_at
      FROM credentials
      WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    return row ? this.mapToCredential(row) : null;
  }

  findByUserId(userId: string): EncryptedCredential[] {
    const stmt = this.db.prepare(`
      SELECT id, user_id, account_name, company_id, encrypted_data, iv, salt, created_at, updated_at
      FROM credentials
      WHERE user_id = ?
      ORDER BY account_name
    `);

    const rows = stmt.all(userId) as any[];
    return rows.map((row) => this.mapToCredential(row));
  }

  findByUserIdAndAccountName(userId: string, accountName: string): EncryptedCredential | null {
    const stmt = this.db.prepare(`
      SELECT id, user_id, account_name, company_id, encrypted_data, iv, salt, created_at, updated_at
      FROM credentials
      WHERE user_id = ? AND account_name = ?
    `);

    const row = stmt.get(userId, accountName) as any;
    return row ? this.mapToCredential(row) : null;
  }

  update(
    id: string,
    encryptedData: string,
    iv: string,
    salt: string
  ): void {
    const updatedAt = Date.now();

    const stmt = this.db.prepare(`
      UPDATE credentials
      SET encrypted_data = ?, iv = ?, salt = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(encryptedData, iv, salt, updatedAt, id);
  }

  delete(id: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM credentials WHERE id = ?
    `);

    stmt.run(id);
  }

  deleteByUserId(userId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM credentials WHERE user_id = ?
    `);

    stmt.run(userId);
  }

  private mapToCredential(row: any): EncryptedCredential {
    return {
      id: row.id,
      userId: row.user_id,
      accountName: row.account_name,
      companyId: row.company_id,
      encryptedData: row.encrypted_data,
      iv: row.iv,
      salt: row.salt,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}