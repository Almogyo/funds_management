export interface User {
  id: string;
  username: string;
  createdAt: number;
  lastLogin?: number;
}

export interface Account {
  id: string;
  userId: string;
  accountNumber: string;
  companyId: CompanyId;
  alias: string;
  active: boolean;
  accountType: 'bank' | 'credit';
  lastScrapedAt?: number;
  createdAt: number;
}

export type CompanyId =
  | 'hapoalim'
  | 'leumi'
  | 'discount'
  | 'mizrahi'
  | 'union'
  | 'massad'
  | 'visaCal'
  | 'max'
  | 'isracard'
  | 'amex';

export interface Transaction {
  id: string;
  accountId: string;
  txnHash: string;
  date: number;
  processedDate: number;
  amount: number;
  currency: string;
  description: string;
  category?: string;
  status: 'completed' | 'pending';
  installmentNumber?: number;
  installmentTotal?: number;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  parentCategory?: string;
  keywords: string[];
  createdAt: number;
}

export interface AnalyticsSummary {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  transactionCount: number;
  accountCount: number;
  startDate: string;
  endDate: string;
}

export interface CategoryDistribution {
  category: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
}

export interface TrendData {
  period: string;
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  transactionCount: number;
}

export interface RecurringPayment {
  merchantName: string;
  category: string;
  amount: number;
  currency: string;
  frequency: number;
  lastPaymentDate: string;
  transactionCount: number;
}

export interface TimeframeFilter {
  startDate: Date;
  endDate: Date;
}

export type QuickFilter = 'last_month' | 'last_3_months' | 'last_6_months' | 'last_year';

export interface AuthResponse {
  message: string;
  sessionId: string;
  userId: string;
  username: string;
}

export interface ApiError {
  error: string;
  message?: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warn' | 'debug';
  message: string;
  context?: Record<string, any>;
}
