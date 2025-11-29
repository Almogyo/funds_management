export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
  lastLogin: Date | null;
}

export interface EncryptedCredential {
  id: string;
  userId: string;
  accountName: string;
  companyId: string;
  encryptedData: string;
  iv: string;
  salt: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Account {
  id: string;
  userId: string;
  accountNumber: string;
  companyId: string;
  alias: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  accountId: string;
  txnHash: string;
  date: Date;
  processedDate: Date;
  amount: number;
  currency: string;
  description: string;
  category: string | null;
  status: 'completed' | 'pending';
  installmentInfo: InstallmentInfo | null;
  rawJson: string;
  createdAt: Date;
}

export interface InstallmentInfo {
  number: number;
  total: number;
}

export interface Category {
  id: string;
  name: string;
  parentCategory: string | null;
  keywords: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ScraperJob {
  id: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date | null;
  completedAt: Date | null;
  accountsToScrape: string[];
  results: ScraperJobResult[];
  error: string | null;
}

export interface ScraperJobResult {
  accountId: string;
  companyId: string;
  success: boolean;
  transactionsCount: number;
  error: string | null;
  duration: number;
}

export interface AnalyticsSummary {
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  highestExpense: Transaction | null;
  topRecurringPayments: RecurringPayment[];
  trends: ExpenseTrend[];
  categoryDistribution: CategoryDistribution[];
  totalExpenses: number;
  totalIncome: number;
  netAmount: number;
}

export interface RecurringPayment {
  merchantName: string;
  category: string;
  amount: number;
  currency: string;
  frequency: number;
  lastPaymentDate: Date;
}

export interface ExpenseTrend {
  period: string;
  totalExpenses: number;
  totalIncome: number;
  netAmount: number;
  transactionCount: number;
}

export interface CategoryDistribution {
  category: string;
  totalAmount: number;
  percentage: number;
  transactionCount: number;
}

export interface JWTPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}