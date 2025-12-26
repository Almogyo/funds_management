import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';
import type {
  AuthResponse,
  Account,
  Transaction,
  AnalyticsSummary,
  CategoryDistribution,
  TrendData,
  RecurringPayment,
  CompanyId,
  ApiError,
  LogEntry,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiClient {
  private client: AxiosInstance;
  private sessionId: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      if (this.sessionId) {
        config.headers['X-Session-ID'] = this.sessionId;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        if (error.response?.status === 401) {
          this.clearSession();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );

    const storedSessionId = localStorage.getItem('sessionId');
    if (storedSessionId) {
      this.sessionId = storedSessionId;
    }
  }

  private setSession(sessionId: string) {
    this.sessionId = sessionId;
    localStorage.setItem('sessionId', sessionId);
  }

  private clearSession() {
    this.sessionId = null;
    localStorage.removeItem('sessionId');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
  }

  isAuthenticated(): boolean {
    return !!this.sessionId;
  }

  async register(username: string, password: string): Promise<AuthResponse> {
    console.log('[ApiClient.register] Sending registration request for user:', username);
    try {
      const response = await this.client.post<AuthResponse>('/api/auth/register', {
        username,
        password,
      });
      console.log('[ApiClient.register] Response received:', response.data);
      this.setSession(response.data.sessionId);
      localStorage.setItem('userId', response.data.userId);
      localStorage.setItem('username', response.data.username);
      console.log('[ApiClient.register] Session and localStorage updated:', {
        sessionId: response.data.sessionId,
        userId: response.data.userId,
        username: response.data.username,
        isAuthenticated: this.isAuthenticated(),
      });
      return response.data;
    } catch (error) {
      console.error('[ApiClient.register] Request failed:', error);
      throw error;
    }
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    console.log('[ApiClient.login] Sending login request for user:', username);
    try {
      const response = await this.client.post<AuthResponse>('/api/auth/login', {
        username,
        password,
      });
      console.log('[ApiClient.login] Response received:', response.data);
      this.setSession(response.data.sessionId);
      localStorage.setItem('userId', response.data.userId);
      localStorage.setItem('username', response.data.username);
      console.log('[ApiClient.login] Session and localStorage updated:', {
        sessionId: response.data.sessionId,
        userId: response.data.userId,
        username: response.data.username,
        isAuthenticated: this.isAuthenticated(),
      });
      return response.data;
    } catch (error) {
      console.error('[ApiClient.login] Request failed:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/api/auth/logout');
    } finally {
      this.clearSession();
    }
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.client.post('/api/auth/change-password', {
      oldPassword,
      newPassword,
    });
  }

  async getAccounts(): Promise<Account[]> {
    const response = await this.client.get<{ accounts: Account[]; count: number }>(
      '/api/accounts'
    );
    return response.data.accounts;
  }

  async getCategories(): Promise<{ id: string; name: string; keywords: string[]; createdAt: number }[]> {
    // moved to domain service `services/categories.ts` - keep behavior for compatibility
    const response = await this.client.get<{ categories: { id: string; name: string; keywords: string[]; createdAt: number }[] }>(
      '/api/categories'
    );
    return response.data.categories;
  }


  async createAccount(
    companyId: CompanyId,
    accountNumber: string,
    alias: string | undefined,
    username: string,
    password: string,
    card6Digits?: string,
    id?: string
  ): Promise<Account> {
    const response = await this.client.post<{ account: Account; message: string }>(
      `/api/accounts/${companyId}`,
      {
        accountNumber,
        ...(alias && { alias }),
        username,
        password,
        ...(card6Digits && { card6Digits }),
        ...(id && { id }),
      }
    );
    return response.data.account;
  }

  async updateAccount(
    id: string,
    updates: { alias?: string; active?: boolean }
  ): Promise<void> {
    await this.client.put(`/api/accounts/${id}`, updates);
  }

  async deleteAccount(id: string): Promise<void> {
    await this.client.delete(`/api/accounts/${id}`);
  }

  async getTransactions(filters?: {
    startDate?: string;
    endDate?: string;
    accountId?: string;
    category?: string;
    categories?: string[];
    minAmount?: number;
    maxAmount?: number;
  }): Promise<Transaction[]> {
    const params: any = { ...filters };
    if (filters?.categories) {
      params.categories = filters.categories.join(',');
      delete params.categoriesArray;
    }

    const response = await this.client.get<{ transactions: Transaction[]; count: number }>(
      '/api/transactions',
      { params }
    );
    return response.data.transactions;
  }

  async updateTransactionCategory(id: string, categoryId: string): Promise<void> {
    await this.client.put(`/api/transactions/${id}/category`, { categoryId });
  }

  async getSummary(startDate: string, endDate: string, accountIds?: string[]): Promise<AnalyticsSummary> {
    const response = await this.client.get<AnalyticsSummary>('/api/analytics/summary', {
      params: { startDate, endDate, accountIds: accountIds?.join(',') },
    });
    return response.data;
  }

  async getCategoryDistribution(
    startDate: string,
    endDate: string,
    accountIds?: string[]
  ): Promise<CategoryDistribution[]> {
    const response = await this.client.get<{ categories: CategoryDistribution[] }>(
      '/api/analytics/category-distribution',
      { params: { startDate, endDate, accountIds: accountIds?.join(',') } }
    );
    return response.data.categories;
  }

  async getTrends(
    startDate: string,
    endDate: string,
    groupBy: 'day' | 'month' = 'month',
    accountIds?: string[]
  ): Promise<TrendData[]> {
    const response = await this.client.get<{ trends: TrendData[] }>(
      '/api/analytics/trends',
      { params: { startDate, endDate, groupBy, accountIds: accountIds?.join(',') } }
    );
    return response.data.trends;
  }

  async getRecurringPayments(
    startDate: string,
    endDate: string,
    accountIds?: string[]
  ): Promise<RecurringPayment[]> {
    const response = await this.client.get<{ payments: RecurringPayment[] }>(
      '/api/analytics/recurring-payments',
      { params: { startDate, endDate, accountIds: accountIds?.join(',') } }
    );
    return response.data.payments;
  }

  async scrapeAccounts(
    startDate: string,
    endDate?: string,
    accountIds?: string[]
  ): Promise<any> {
    const response = await this.client.post('/api/scrape', {
      startDate,
      endDate,
      accountIds,
    });
    return response.data;
  }

  async getLogs(limit?: number, level?: string, since?: string): Promise<LogEntry[]> {
    const response = await this.client.get<{ logs: LogEntry[]; count: number }>(
      '/api/logs',
      { params: { limit, level, since } }
    );
    return response.data.logs;
  }
}

export const apiClient = new ApiClient();