import { describe, it, expect, beforeAll } from 'vitest';
import axios from 'axios';
import type {
  AnalyticsSummary,
  CategoryDistribution,
  TrendData,
  RecurringPayment,
  Account,
  Transaction,
} from '../../types';

const BASE_URL = process.env.VITE_API_URL || 'http://localhost:3000';
const TEST_SESSION_ID = process.env.TEST_SESSION_ID || '';

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-Session-ID': TEST_SESSION_ID,
  },
});

describe('API Contract Tests', () => {
  let testAccountId: string;
  const startDate = '2024-01-01';
  const endDate = '2025-12-31';

  beforeAll(async () => {
    if (!TEST_SESSION_ID) {
      console.warn('⚠️  TEST_SESSION_ID not set. Skipping contract tests.');
      console.warn('To run these tests, set TEST_SESSION_ID environment variable');
      return;
    }

    try {
      const response = await client.get('/api/accounts');
      if (response.data.accounts && response.data.accounts.length > 0) {
        testAccountId = response.data.accounts[0].id;
      }
    } catch (error) {
      console.warn('Could not fetch test account:', error);
    }
  });

  describe('Analytics Endpoints - Response Structure', () => {
    it('GET /api/analytics/summary should return correct structure', async () => {
      if (!TEST_SESSION_ID) return;

      const response = await client.get<AnalyticsSummary>('/api/analytics/summary', {
        params: { startDate, endDate },
      });

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      
      // Verify all required fields exist
      expect(response.data).toHaveProperty('totalIncome');
      expect(response.data).toHaveProperty('totalExpenses');
      expect(response.data).toHaveProperty('netIncome');
      expect(response.data).toHaveProperty('transactionCount');
      expect(response.data).toHaveProperty('accountCount');
      expect(response.data).toHaveProperty('startDate');
      expect(response.data).toHaveProperty('endDate');

      // Verify types
      expect(typeof response.data.totalIncome).toBe('number');
      expect(typeof response.data.totalExpenses).toBe('number');
      expect(typeof response.data.netIncome).toBe('number');
      expect(typeof response.data.transactionCount).toBe('number');
      expect(typeof response.data.accountCount).toBe('number');
      expect(typeof response.data.startDate).toBe('string');
      expect(typeof response.data.endDate).toBe('string');
    });

    it('GET /api/analytics/category-distribution should return correct structure', async () => {
      if (!TEST_SESSION_ID) return;

      const response = await client.get<{ categories: CategoryDistribution[] }>(
        '/api/analytics/category-distribution',
        { params: { startDate, endDate } }
      );

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data).toHaveProperty('categories');
      expect(Array.isArray(response.data.categories)).toBe(true);

      if (response.data.categories.length > 0) {
        const category = response.data.categories[0];
        
        // Verify all required fields exist
        expect(category).toHaveProperty('category');
        expect(category).toHaveProperty('totalAmount');
        expect(category).toHaveProperty('transactionCount');
        expect(category).toHaveProperty('percentage');

        // Verify types
        expect(typeof category.category).toBe('string');
        expect(typeof category.totalAmount).toBe('number');
        expect(typeof category.transactionCount).toBe('number');
        expect(typeof category.percentage).toBe('number');
      }
    });

    it('GET /api/analytics/trends should return correct structure', async () => {
      if (!TEST_SESSION_ID) return;

      const response = await client.get<{ trends: TrendData[] }>(
        '/api/analytics/trends',
        { params: { startDate, endDate, groupBy: 'month' } }
      );

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data).toHaveProperty('trends');
      expect(Array.isArray(response.data.trends)).toBe(true);

      if (response.data.trends.length > 0) {
        const trend = response.data.trends[0];
        
        // Verify all required fields exist
        expect(trend).toHaveProperty('period');
        expect(trend).toHaveProperty('totalIncome');
        expect(trend).toHaveProperty('totalExpenses');
        expect(trend).toHaveProperty('netAmount');
        expect(trend).toHaveProperty('transactionCount');

        // Verify types
        expect(typeof trend.period).toBe('string');
        expect(typeof trend.totalIncome).toBe('number');
        expect(typeof trend.totalExpenses).toBe('number');
        expect(typeof trend.netAmount).toBe('number');
        expect(typeof trend.transactionCount).toBe('number');
      }
    });

    it('GET /api/analytics/recurring-payments should return correct structure', async () => {
      if (!TEST_SESSION_ID) return;

      const response = await client.get<{ payments: RecurringPayment[] }>(
        '/api/analytics/recurring-payments',
        { params: { startDate, endDate } }
      );

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data).toHaveProperty('payments');
      expect(Array.isArray(response.data.payments)).toBe(true);

      if (response.data.payments.length > 0) {
        const payment = response.data.payments[0];
        
        // Verify all required fields exist
        expect(payment).toHaveProperty('merchantName');
        expect(payment).toHaveProperty('category');
        expect(payment).toHaveProperty('amount');
        expect(payment).toHaveProperty('currency');
        expect(payment).toHaveProperty('frequency');
        expect(payment).toHaveProperty('lastPaymentDate');
        expect(payment).toHaveProperty('transactionCount');

        // Verify types
        expect(typeof payment.merchantName).toBe('string');
        expect(typeof payment.category).toBe('string');
        expect(typeof payment.amount).toBe('number');
        expect(typeof payment.currency).toBe('string');
        expect(typeof payment.frequency).toBe('number');
        expect(typeof payment.lastPaymentDate).toBe('string');
        expect(typeof payment.transactionCount).toBe('number');
      }
    });
  });

  describe('Accounts Endpoints - Response Structure', () => {
    it('GET /api/accounts should return correct structure', async () => {
      if (!TEST_SESSION_ID) return;

      const response = await client.get<{ accounts: Account[]; count: number }>(
        '/api/accounts'
      );

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data).toHaveProperty('accounts');
      expect(response.data).toHaveProperty('count');
      expect(Array.isArray(response.data.accounts)).toBe(true);
      expect(typeof response.data.count).toBe('number');

      if (response.data.accounts.length > 0) {
        const account = response.data.accounts[0];
        
        // Verify all required fields exist
        expect(account).toHaveProperty('id');
        expect(account).toHaveProperty('userId');
        expect(account).toHaveProperty('accountNumber');
        expect(account).toHaveProperty('companyId');
        expect(account).toHaveProperty('alias');
        expect(account).toHaveProperty('active');
        expect(account).toHaveProperty('accountType');
        expect(account).toHaveProperty('createdAt');
        expect(account).toHaveProperty('updatedAt');

        // Verify types
        expect(typeof account.id).toBe('string');
        expect(typeof account.userId).toBe('string');
        expect(typeof account.accountNumber).toBe('string');
        expect(typeof account.companyId).toBe('string');
        expect(typeof account.alias).toBe('string');
        expect(typeof account.active).toBe('boolean');
        expect(['bank', 'credit']).toContain(account.accountType);
        expect(typeof account.createdAt).toBe('number');
        expect(typeof account.updatedAt).toBe('number');
      }
    });
  });

  describe('Transactions Endpoints - Response Structure', () => {
    it('GET /api/transactions should return correct structure', async () => {
      if (!TEST_SESSION_ID) return;

      const response = await client.get<{ transactions: Transaction[]; count: number }>(
        '/api/transactions'
      );

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data).toHaveProperty('transactions');
      expect(response.data).toHaveProperty('count');
      expect(Array.isArray(response.data.transactions)).toBe(true);
      expect(typeof response.data.count).toBe('number');

      if (response.data.transactions.length > 0) {
        const transaction = response.data.transactions[0];
        
        // Verify all required fields exist
        expect(transaction).toHaveProperty('id');
        expect(transaction).toHaveProperty('accountId');
        expect(transaction).toHaveProperty('date');
        expect(transaction).toHaveProperty('processedDate');
        expect(transaction).toHaveProperty('amount');
        expect(transaction).toHaveProperty('currency');
        expect(transaction).toHaveProperty('description');
        expect(transaction).toHaveProperty('status');
        expect(transaction).toHaveProperty('createdAt');

        // Verify types
        expect(typeof transaction.id).toBe('string');
        expect(typeof transaction.accountId).toBe('string');
        expect(typeof transaction.date).toBe('number');
        expect(typeof transaction.processedDate).toBe('number');
        expect(typeof transaction.amount).toBe('number');
        expect(typeof transaction.currency).toBe('string');
        expect(typeof transaction.description).toBe('string');
        expect(['completed', 'pending']).toContain(transaction.status);
        expect(typeof transaction.createdAt).toBe('number');
      }
    });
  });

  describe('Analytics with Account Filtering', () => {
    it('should accept accountIds parameter and return filtered results', async () => {
      if (!TEST_SESSION_ID || !testAccountId) return;

      const response = await client.get<AnalyticsSummary>('/api/analytics/summary', {
        params: { 
          startDate, 
          endDate,
          accountIds: testAccountId,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data.accountCount).toBeGreaterThanOrEqual(1);
    });
  });
});