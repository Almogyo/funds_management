# Repository Tests

This directory contains tests for the repository layer.

## transaction.repository.test.ts

Tests for the `TransactionRepository`, specifically the `getTotalsByCategory()` method which is used to generate the "Expenses by Category" analytics card.

### Test Coverage

The test suite validates the following behavior:

#### 1. **Basic Grouping** (`should return expenses grouped by category`)
- Creates three transactions with different categories
- Verifies they are grouped correctly by category
- Validates the aggregated amounts are correct
- Ensures the transaction count per category is accurate

**Purpose**: Ensures the SQL `GROUP BY` clause properly aggregates transactions by category using the junction table.

#### 2. **Expense Filtering** (`should exclude income transactions`)
- Creates both income (positive amount) and expense (negative amount) transactions
- Attaches the same category to both
- Verifies that only the expense appears in results
- Confirms the income transaction is excluded

**Purpose**: Validates that the `WHERE t.amount < 0` condition properly filters to show only expenses, not income.

**Implementation Detail**: The query includes `t.amount < 0` in the WHERE clause to ensure only negative amounts (expenses) are included in the aggregation.

#### 3. **Multiple Categories per Transaction** (`should handle transactions with multiple categories`)
- Creates a single transaction
- Attaches it to two different categories
- Verifies the amount is correctly allocated to both categories
- Confirms `COUNT(DISTINCT t.id)` prevents double-counting

**Purpose**: Ensures that when a transaction has multiple categories:
- The full amount is attributed to each category (not split)
- The transaction count uses `COUNT(DISTINCT t.id)` to avoid duplicates
- The junction table join doesn't cause duplicate summation

**Implementation Detail**: Uses `COUNT(DISTINCT t.id)` to count unique transactions while `SUM(t.amount)` properly aggregates amounts per category.

#### 4. **Date Range Filtering** (`should respect date range filtering`)
- Creates transactions in different months
- Filters to a specific date range (March only)
- Verifies only the matching period's data is returned

**Purpose**: Validates that the optional `startDate` and `endDate` parameters correctly filter results by the transaction date.

#### 5. **Empty Results** (`should return empty array when no expenses found`)
- Creates an account with no transactions
- Queries the empty account
- Verifies an empty array is returned

**Purpose**: Ensures graceful handling when there are no matching transactions.

#### 6. **Multi-Account Support** (`should handle multiple accounts correctly`)
- Creates two accounts with transactions
- Attaches different categories to each
- Queries both accounts together
- Verifies results combine data from both accounts correctly

**Purpose**: Validates that the query correctly handles filtering by multiple account IDs using `IN` clause.

### Running the Tests

```bash
cd service
npm test -- src/repositories/__tests__/transaction.repository.test.ts
```

Or run all tests:

```bash
npm test
```

### Key Implementation Details

The `getTotalsByCategory()` method uses this SQL pattern:

```sql
SELECT c.name as category, SUM(t.amount) as total, COUNT(DISTINCT t.id) as count
FROM transactions t
JOIN transaction_categories tc ON t.id = tc.transaction_id
JOIN categories c ON tc.category_id = c.id
WHERE t.amount < 0 [AND other filters]
GROUP BY c.id, c.name
ORDER BY total ASC
```

**Critical aspects**:
1. **`WHERE t.amount < 0`** - Filters to only expenses (negative amounts)
2. **`JOIN transaction_categories`** - Accesses the many-to-many relationship
3. **`GROUP BY c.id, c.name`** - Aggregates by category
4. **`COUNT(DISTINCT t.id)`** - Counts unique transactions to avoid duplication when a transaction has multiple categories
5. **`ORDER BY total ASC`** - Orders by most negative amount first (highest expenses)
6. **`SUM(t.amount)`** - Correctly aggregates all amounts attributed to each category

### Database Schema Assumptions

The tests assume:

```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  amount REAL NOT NULL,
  date INTEGER NOT NULL,
  ...
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  ...
);

CREATE TABLE transaction_categories (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  is_manual INTEGER NOT NULL DEFAULT 0,
  ...
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  UNIQUE(transaction_id, category_id)
);
```

### Recent Fixes

As of the latest update, the following issues were fixed in the implementation:

1. **Query now properly filters expenses** - Added `t.amount < 0` to WHERE clause instead of relying on post-query filtering
2. **Analytics service simplified** - Removed duplicate filtering in `calculateCategoryDistribution()` since filtering now happens at the query level
3. **Correct grouping** - Uses proper `COUNT(DISTINCT t.id)` to prevent double-counting when transactions have multiple categories
4. **Proper ordering** - Changed ORDER BY to ASC so highest expenses (most negative) appear first

These tests validate all of these fixes work correctly.
