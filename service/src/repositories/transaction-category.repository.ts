import { Database } from 'better-sqlite3';
import { TransactionCategory } from '../types';
import { randomUUID } from 'crypto';

export class TransactionCategoryRepository {
  constructor(private db: Database) {}

  /**
   * Attach a category to a transaction
   */
  attach(
    transactionId: string,
    categoryId: string,
    isManual: boolean = false,
    isMain: boolean = false
  ): TransactionCategory {
    const id = randomUUID();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO transaction_categories (id, transaction_id, category_id, is_manual, is_main, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, transactionId, categoryId, isManual ? 1 : 0, isMain ? 1 : 0, now);

    return {
      id,
      categoryId,
      categoryName: '', // Will be populated from category lookup
      isManual,
      isMain,
      createdAt: new Date(now),
    };
  }

  /**
   * Get all categories for a transaction, enriched with category names
   */
  getByTransactionId(transactionId: string): TransactionCategory[] {
    const stmt = this.db.prepare(`
      SELECT tc.id, tc.category_id, c.name, tc.is_manual, tc.is_main, tc.created_at
      FROM transaction_categories tc
      JOIN categories c ON tc.category_id = c.id
      WHERE tc.transaction_id = ?
      ORDER BY tc.is_main DESC, tc.created_at DESC
    `);

    const rows = stmt.all(transactionId) as any[];
    return rows.map((row) => ({
      id: row.id,
      categoryId: row.category_id,
      categoryName: row.name,
      isManual: row.is_manual === 1,
      isMain: row.is_main === 1,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Set a specific category as the main category for a transaction
   * Removes is_main from all other categories for this transaction
   */
  setAsMain(transactionId: string, categoryId: string): void {
    const transaction = this.db.transaction(
      (txnId: string, catId: string) => {
        // Set all categories for this transaction to not main
        this.db
          .prepare(
            `UPDATE transaction_categories SET is_main = 0 WHERE transaction_id = ?`
          )
          .run(txnId);

        // Set the specified category as main
        this.db
          .prepare(
            `UPDATE transaction_categories SET is_main = 1 
           WHERE transaction_id = ? AND category_id = ?`
          )
          .run(txnId, catId);
      }
    );

    transaction(transactionId, categoryId);
  }

  /**
   * Get the main category for a transaction
   */
  getMainCategory(transactionId: string): TransactionCategory | null {
    const stmt = this.db.prepare(`
      SELECT tc.id, tc.category_id, c.name, tc.is_manual, tc.is_main, tc.created_at
      FROM transaction_categories tc
      JOIN categories c ON tc.category_id = c.id
      WHERE tc.transaction_id = ? AND tc.is_main = 1
      LIMIT 1
    `);

    const row = stmt.get(transactionId) as any;
    if (!row) return null;

    return {
      id: row.id,
      categoryId: row.category_id,
      categoryName: row.name,
      isManual: row.is_manual === 1,
      isMain: row.is_main === 1,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Remove all automatic categories for a transaction (used when keywords change)
   */
  removeAutomatic(transactionId: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM transaction_categories
      WHERE transaction_id = ? AND is_manual = 0
    `);

    const result = stmt.run(transactionId);
    return result.changes || 0;
  }

  /**
   * Remove all categories for a transaction
   */
  removeAll(transactionId: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM transaction_categories
      WHERE transaction_id = ?
    `);

    const result = stmt.run(transactionId);
    return result.changes || 0;
  }

  /**
   * Remove a specific category from a transaction
   */
  detach(transactionId: string, categoryId: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM transaction_categories
      WHERE transaction_id = ? AND category_id = ?
    `);

    const result = stmt.run(transactionId, categoryId);
    return result.changes || 0;
  }

  /**
   * Check if a transaction has a specific category attached
   */
  hasCategory(transactionId: string, categoryId: string): boolean {
    const stmt = this.db.prepare(`
      SELECT 1 FROM transaction_categories
      WHERE transaction_id = ? AND category_id = ?
      LIMIT 1
    `);

    return stmt.get(transactionId, categoryId) !== undefined;
  }

  /**
   * Get all transactions for a category
   */
  getTransactionsByCategoryId(categoryId: string): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT transaction_id FROM transaction_categories
      WHERE category_id = ?
    `);

    const rows = stmt.all(categoryId) as any[];
    return rows.map((row) => row.transaction_id);
  }

  /**
   * Replace all automatic categories for a transaction (for bulk re-evaluation)
   * If forceMainCategoryId is provided and exists in categoryIds, 
   * that category will be set as the main category. Otherwise, first category is main.
   */
  replaceAutomatic(
    transactionId: string,
    categoryIds: string[],
    forceMainCategoryId?: string
  ): TransactionCategory[] {
    // Use transaction to ensure atomicity
    const transaction = this.db.transaction(() => {
      // Remove old automatic categories
      this.removeAutomatic(transactionId);

      // Check if forceMainCategoryId exists in categoryIds
      const forcedCategoryExists = forceMainCategoryId && categoryIds.includes(forceMainCategoryId);

      // Add new automatic categories
      const results: TransactionCategory[] = [];
      for (let i = 0; i < categoryIds.length; i++) {
        const categoryId = categoryIds[i];
        // Mark as main if: (1) forceMainCategoryId provided and matches, or (2) it's the first one and no forced match
        const isMain = forcedCategoryExists ? categoryId === forceMainCategoryId : i === 0;
        const result = this.attach(transactionId, categoryId, false, isMain);
        results.push(result);
      }
      return results;
    });

    return transaction();
  }

  /**
   * Bulk update categories for multiple transactions
   * Format: { transactionId, categoryIds: string[], forceMainCategoryId?: string }
   * If forceMainCategoryId is provided and exists in categoryIds, that category will be set as main.
   * Otherwise, the first category is marked as main.
   */
  bulkReplaceAutomatic(
    updates: Array<{ transactionId: string; categoryIds: string[]; forceMainCategoryId?: string }>
  ): number {
    const transaction = this.db.transaction(
      (updates: Array<{ transactionId: string; categoryIds: string[]; forceMainCategoryId?: string }>) => {
        let totalUpdated = 0;
        for (const { transactionId, categoryIds, forceMainCategoryId } of updates) {
          this.removeAutomatic(transactionId);
          
          // Check if forceMainCategoryId exists in categoryIds
          const forcedCategoryExists = forceMainCategoryId && categoryIds.includes(forceMainCategoryId);

          for (let i = 0; i < categoryIds.length; i++) {
            const categoryId = categoryIds[i];
            // Mark as main if: (1) forceMainCategoryId provided and matches, or (2) it's the first one and no forced match
            const isMain = forcedCategoryExists ? categoryId === forceMainCategoryId : i === 0;
            this.attach(transactionId, categoryId, false, isMain);
            totalUpdated++;
          }
        }
        return totalUpdated;
      }
    );

    return transaction(updates);
  }

  /**
   * Get transactions that need re-categorization (all transactions)
   */
  getAllTransactionDescriptions(): Array<{ id: string; description: string }> {
    const stmt = this.db.prepare(`
      SELECT id, description FROM transactions ORDER BY created_at DESC
    `);

    return stmt.all() as Array<{ id: string; description: string }>;
  }
}
