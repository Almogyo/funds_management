import { Database } from 'better-sqlite3';
import { Category } from '../types';
import { randomUUID } from 'crypto';

export class CategoryRepository {
  constructor(private db: Database) {}

  create(name: string, parentCategory: string | null, keywords: string[]): Category {
    const id = randomUUID();
    const now = Date.now();
    const keywordsJson = JSON.stringify(keywords);

    const stmt = this.db.prepare(`
      INSERT INTO categories (id, name, parent_category, keywords_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, name, parentCategory, keywordsJson, now, now);

    return {
      id,
      name,
      parentCategory,
      keywords,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  findById(id: string): Category | null {
    const stmt = this.db.prepare(`
      SELECT id, name, parent_category, keywords_json, created_at, updated_at
      FROM categories
      WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    return row ? this.mapToCategory(row) : null;
  }

  findByName(name: string): Category | null {
    const stmt = this.db.prepare(`
      SELECT id, name, parent_category, keywords_json, created_at, updated_at
      FROM categories
      WHERE name = ?
    `);

    const row = stmt.get(name) as any;
    return row ? this.mapToCategory(row) : null;
  }

  list(): Category[] {
    const stmt = this.db.prepare(`
      SELECT id, name, parent_category, keywords_json, created_at, updated_at
      FROM categories
      ORDER BY name
    `);

    const rows = stmt.all() as any[];
    return rows.map((row) => this.mapToCategory(row));
  }

  update(id: string, updates: { name?: string; parentCategory?: string | null; keywords?: string[] }): void {
    const updatedAt = Date.now();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }

    if (updates.parentCategory !== undefined) {
      fields.push('parent_category = ?');
      values.push(updates.parentCategory);
    }

    if (updates.keywords !== undefined) {
      fields.push('keywords_json = ?');
      values.push(JSON.stringify(updates.keywords));
    }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    values.push(updatedAt, id);

    const stmt = this.db.prepare(`
      UPDATE categories
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
  }

  delete(id: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM categories WHERE id = ?
    `);

    stmt.run(id);
  }

  searchByKeyword(keyword: string): Category[] {
    const stmt = this.db.prepare(`
      SELECT id, name, parent_category, keywords_json, created_at, updated_at
      FROM categories
      WHERE keywords_json LIKE ?
    `);

    const rows = stmt.all(`%${keyword}%`) as any[];
    return rows.map((row) => this.mapToCategory(row));
  }

  private mapToCategory(row: any): Category {
    return {
      id: row.id,
      name: row.name,
      parentCategory: row.parent_category,
      keywords: JSON.parse(row.keywords_json),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}