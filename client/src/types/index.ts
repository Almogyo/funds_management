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
  card6Digits?: string | null;
  username?: string; // For display in edit dialog (never includes password)
  userIdNumber?: string; // For Isracard user identification number (for display in edit dialog)
  lastScrapedAt?: number;
  createdAt: number;
  updatedAt?: number;
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
  categories?: TransactionCategory[];
  mainCategoryId?: string | null;
  status: 'completed' | 'pending';
  installmentNumber?: number;
  installmentTotal?: number;
  createdAt: number;
}

export interface TransactionCategory {
  id: string;
  categoryId: string;
  categoryName: string;
  isManual: boolean;
  isMain?: boolean;
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
  lastDataUpdate?: string | null;
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
  profitTrend: number; // Cumulative profit trend line
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

export interface CreditCardAccount {
  id: string;
  username: string;
  password: string;
  card6Digits: string;
  otpCodeRetriever?: () => Promise<string>;
  alias?: string;
  companyId: string;
  active: boolean;
  lastScrapedAt?: string;
}
