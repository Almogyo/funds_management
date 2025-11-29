# Testing Guide

This project includes comprehensive testing to ensure the frontend and backend stay in sync.

## Test Types

### 1. API Contract Tests
Location: `client/src/services/__tests__/api.contract.test.ts`

These tests verify that:
- ✅ Backend API responses match frontend TypeScript types
- ✅ All required fields are present in responses
- ✅ Field types are correct (string, number, boolean, etc.)
- ✅ Response structures match expectations (wrapped vs unwrapped)
- ✅ Account filtering works correctly across all analytics endpoints

**Why this matters:**
Contract tests prevent issues where the backend and frontend diverge, causing runtime errors that TypeScript can't catch.

### 2. Unit Tests (Backend)
Location: `src/**/__tests__/*.test.ts`

Test individual services and utilities in isolation.

## Running Tests Locally

### Prerequisites
```bash
# Install dependencies
npm install
cd client && npm install && cd ..
```

### Run All Tests
```bash
# Backend tests
npm test

# Frontend tests
cd client && npm test

# Contract tests (requires running backend)
cd client && npm run test:contract
```

### Run Contract Tests

1. **Start the backend:**
   ```bash
   npm run dev
   ```

2. **Get a session ID:**
   - Open http://localhost:5173 in your browser
   - Login with your credentials
   - Open Developer Tools (F12)
   - Go to Application → Local Storage → http://localhost:5173
   - Copy the `sessionId` value

3. **Run contract tests:**
   ```bash
   export TEST_SESSION_ID="your-session-id-here"
   cd client
   npm run test:contract
   ```

### Watch Mode
```bash
# Frontend tests in watch mode
cd client && npm test

# With UI
cd client && npm run test:ui
```

## CI/CD Integration

Contract tests run automatically on:
- Every push to `main` or `develop` branches
- Every pull request

See `.github/workflows/api-contract-tests.yml` for the full CI configuration.

## What Gets Tested

### Analytics Endpoints
| Endpoint | Verified Fields |
|----------|----------------|
| `GET /api/analytics/summary` | totalIncome, totalExpenses, netIncome, transactionCount, accountCount, startDate, endDate |
| `GET /api/analytics/category-distribution` | category, totalAmount, transactionCount, percentage |
| `GET /api/analytics/trends` | period, totalIncome, totalExpenses, netAmount, transactionCount |
| `GET /api/analytics/recurring-payments` | merchantName, category, amount, currency, frequency, lastPaymentDate, transactionCount |

### Data Endpoints
| Endpoint | Verified Fields |
|----------|----------------|
| `GET /api/accounts` | id, userId, accountNumber, companyId, alias, active, accountType, createdAt, updatedAt, lastScrapedAt |
| `GET /api/transactions` | id, accountId, date, processedDate, amount, currency, description, category, status, createdAt |

## Adding New Tests

When you add a new API endpoint:

1. **Add the type** to `client/src/types/index.ts`
2. **Add the API method** to `client/src/services/api.ts`
3. **Add a contract test** to `client/src/services/__tests__/api.contract.test.ts`

Example:
```typescript
it('GET /api/your-endpoint should return correct structure', async () => {
  const response = await client.get<YourType>('/api/your-endpoint');
  
  expect(response.status).toBe(200);
  expect(response.data).toHaveProperty('yourField');
  expect(typeof response.data.yourField).toBe('string');
});
```

## Common Issues

### "TEST_SESSION_ID not set"
**Solution:** Set the environment variable before running tests:
```bash
export TEST_SESSION_ID="your-session-id"
```

### "Connection refused"
**Solution:** Make sure the backend is running:
```bash
npm run dev
```

### "401 Unauthorized"
**Solution:** Your session expired. Get a fresh session ID from the browser.

### Tests pass locally but fail in CI
**Solution:** Check that:
1. The health endpoint returns 200
2. Test user creation works
3. Session ID is correctly extracted

## Test Coverage

Generate coverage reports:

```bash
# Backend coverage
npm test -- --coverage

# Frontend coverage
cd client && npm test -- --coverage
```

View coverage reports:
- Backend: `coverage/index.html`
- Frontend: `client/coverage/index.html`

## Best Practices

1. **Always run contract tests** before pushing changes that affect API endpoints
2. **Update tests immediately** when changing API response structures
3. **Add tests for new endpoints** as you create them
4. **Keep types in sync** between backend and frontend
5. **Use TypeScript** to catch type mismatches early
6. **Review failed tests** in CI before merging PRs

## Troubleshooting Test Failures

### Backend Type Changed
1. Update the TypeScript type in `client/src/types/index.ts`
2. Update the contract test expectations
3. Update any components using that type

### Frontend Type Changed
1. Check if backend needs to change too
2. Update contract test expectations
3. Run tests to verify

### Field Name Mismatch
Example: Backend returns `totalAmount` but frontend expects `total`

**Solution:**
1. Choose the correct name (prefer backend naming)
2. Update frontend type
3. Update all usages in components
4. Update contract test

## Continuous Improvement

These contract tests are a living document of your API. As your application grows:
- Add more assertions
- Test edge cases (empty arrays, null values)
- Test error responses
- Test pagination
- Test filtering and sorting