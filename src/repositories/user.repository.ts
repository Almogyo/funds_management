import { Database } from 'better-sqlite3';
import { User } from '../types';
import { randomUUID } from 'crypto';

export class UserRepository {
  constructor(private db: Database) {}

  create(username: string, passwordHash: string): User {
    const id = randomUUID();
    const createdAt = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO users (id, username, password_hash, created_at, last_login)
      VALUES (?, ?, ?, ?, NULL)
    `);

    stmt.run(id, username, passwordHash, createdAt);

    return {
      id,
      username,
      passwordHash,
      createdAt: new Date(createdAt),
      lastLogin: null,
    };
  }

  findById(id: string): User | null {
    const stmt = this.db.prepare(`
      SELECT id, username, password_hash, created_at, last_login
      FROM users
      WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    return row ? this.mapToUser(row) : null;
  }

  findByUsername(username: string): User | null {
    const stmt = this.db.prepare(`
      SELECT id, username, password_hash, created_at, last_login
      FROM users
      WHERE username = ?
    `);

    const row = stmt.get(username) as any;
    return row ? this.mapToUser(row) : null;
  }

  updateLastLogin(id: string): void {
    const lastLogin = Date.now();
    const stmt = this.db.prepare(`
      UPDATE users
      SET last_login = ?
      WHERE id = ?
    `);

    stmt.run(lastLogin, id);
  }

  updatePassword(id: string, passwordHash: string): void {
    const stmt = this.db.prepare(`
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
    `);

    stmt.run(passwordHash, id);
  }

  delete(id: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM users WHERE id = ?
    `);

    stmt.run(id);
  }

  list(): User[] {
    const stmt = this.db.prepare(`
      SELECT id, username, password_hash, created_at, last_login
      FROM users
      ORDER BY created_at DESC
    `);

    const rows = stmt.all() as any[];
    return rows.map((row) => this.mapToUser(row));
  }

  private mapToUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash,
      createdAt: new Date(row.created_at),
      lastLogin: row.last_login ? new Date(row.last_login) : null,
    };
  }
}