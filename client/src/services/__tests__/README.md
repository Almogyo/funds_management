# API Contract Tests

These tests verify that the frontend and backend API contracts are in sync. They ensure that:
1. Response structures match frontend TypeScript types
2. All required fields are present
3. Field types are correct
4. Wrapped responses are properly formatted

## Running Contract Tests

### Prerequisites
1. Backend server must be running on `http://localhost:3000`
2. You need a valid session ID

### Getting a Session ID

1. **Start both servers:**
   ```bash
   npm run dev:all
   ```

2. **Login via the UI:**
   - Open http://localhost:5173
   - Login with your credentials

3. **Get the session ID from browser:**
   - Open Developer Tools (F12)
   - Go to Application/Storage → Local Storage → http://localhost:5173
   - Copy the value of `sessionId`

### Running the Tests

```bash
# Set the session ID
export TEST_SESSION_ID="your-session-id-here"

# Run contract tests
cd client
npm run test:contract

# Or run all tests
npm test

# Or run tests with UI
npm run test:ui
```

### What Gets Tested

#### Analytics Endpoints
- ✅ `GET /api/analytics/summary` - Verifies financial summary structure
- ✅ `GET /api/analytics/category-distribution` - Verifies category breakdown structure
- ✅ `GET /api/analytics/trends` - Verifies trend data structure
- ✅ `GET /api/analytics/recurring-payments` - Verifies recurring payments structure

#### Account Endpoints
- ✅ `GET /api/accounts` - Verifies account list structure

#### Transaction Endpoints
- ✅ `GET /api/transactions` - Verifies transaction list structure

#### Filtering
- ✅ Account ID filtering works correctly

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Contract Tests
  env:
    TEST_SESSION_ID: ${{ secrets.TEST_SESSION_ID }}
  run: |
    npm run dev &
    cd client && npm run test:contract
```

## Troubleshooting

**Tests are skipped:**
- Make sure `TEST_SESSION_ID` environment variable is set
- Verify backend is running on port 3000

**401 Unauthorized:**
- Your session may have expired
- Get a fresh session ID from the browser

**Connection refused:**
- Make sure backend is running: `npm run dev`
- Check that port 3000 is available

## Adding New Tests

When you add a new API endpoint:

1. Add the type to `client/src/types/index.ts`
2. Add the API method to `client/src/services/api.ts`
3. Add a contract test to this file

Example:
```typescript
it('GET /api/your-new-endpoint should return correct structure', async () => {
  const response = await client.get<YourType>('/api/your-new-endpoint');
  
  expect(response.status).toBe(200);
  expect(response.data).toHaveProperty('yourField');
  expect(typeof response.data.yourField).toBe('string');
});
```