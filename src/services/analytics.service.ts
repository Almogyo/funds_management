import { Logger } from '../utils/logger';
import { TransactionRepository } from '../repositories/transaction.repository';
import { Transaction } from '../types';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface HighestExpense {
  transaction: Transaction;
  amount: number;
  category: string | null;
  description: string;
  date: Date;
}

export interface RecurringPayment {
  merchantName: string;
  category: string;
  amount: number;
  currency: string;
  frequency: number;
  lastPaymentDate: Date;
  transactionCount: number;
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

export class AnalyticsService {
  constructor(
    private logger: Logger,
    private transactionRepository: TransactionRepository
  ) {}

  calculateHighestExpense(accountIds: string[], dateRange: DateRange): HighestExpense | null {
    this.logger.calculationLog('Calculating highest expense', {
      accountIds,
      dateRange,
    });

    const transactions = this.transactionRepository.findWithFilters({
      accountIds,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      status: 'completed',
    });

    if (transactions.length === 0) {
      this.logger.calculationLog('No transactions found for highest expense calculation');
      return null;
    }

    const expenses = transactions.filter((t) => t.amount < 0);

    if (expenses.length === 0) {
      this.logger.calculationLog('No expense transactions found');
      return null;
    }

    const highest = expenses.reduce((max, txn) => (txn.amount < max.amount ? txn : max));

    this.logger.calculationLog('Highest expense calculated', {
      amount: Math.abs(highest.amount),
      description: highest.description,
      date: highest.date,
    });

    return {
      transaction: highest,
      amount: Math.abs(highest.amount),
      category: highest.category,
      description: highest.description,
      date: highest.date,
    };
  }

  calculateTopRecurringPayments(
    accountIds: string[],
    dateRange: DateRange,
    topN: number = 5
  ): RecurringPayment[] {
    this.logger.calculationLog('Calculating top recurring payments', {
      accountIds,
      dateRange,
      topN,
    });

    const transactions = this.transactionRepository.findWithFilters({
      accountIds,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      status: 'completed',
    });

    const expenses = transactions.filter((t) => t.amount < 0);

    const merchantGroups = new Map<string, Transaction[]>();

    for (const txn of expenses) {
      const normalizedMerchant = this.normalizeMerchantName(txn.description);
      const existing = merchantGroups.get(normalizedMerchant) || [];
      existing.push(txn);
      merchantGroups.set(normalizedMerchant, existing);
    }

    const recurring: RecurringPayment[] = [];

    for (const [merchant, txns] of merchantGroups.entries()) {
      if (txns.length >= 2) {
        const amounts = txns.map((t) => Math.abs(t.amount));
        const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
        const lastTxn = txns.reduce((latest, t) => (t.date > latest.date ? t : latest));

        recurring.push({
          merchantName: merchant,
          category: txns[0].category || 'Unknown',
          amount: avgAmount,
          currency: txns[0].currency,
          frequency: txns.length,
          lastPaymentDate: lastTxn.date,
          transactionCount: txns.length,
        });
      }
    }

    recurring.sort((a, b) => b.amount * b.frequency - a.amount * a.frequency);

    const topRecurring = recurring.slice(0, topN);

    this.logger.calculationLog('Top recurring payments calculated', {
      totalRecurring: recurring.length,
      topN: topRecurring.length,
    });

    return topRecurring;
  }

  calculateExpenseTrends(
    accountIds: string[],
    dateRange: DateRange,
    granularity: 'daily' | 'monthly' = 'monthly'
  ): ExpenseTrend[] {
    this.logger.calculationLog('Calculating expense trends', {
      accountIds,
      dateRange,
      granularity,
    });

    const transactions = this.transactionRepository.findWithFilters({
      accountIds,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      status: 'completed',
    });

    const periodMap = new Map<string, Transaction[]>();

    for (const txn of transactions) {
      const period = this.getPeriodKey(txn.date, granularity);
      const existing = periodMap.get(period) || [];
      existing.push(txn);
      periodMap.set(period, existing);
    }

    const trends: ExpenseTrend[] = [];

    for (const [period, txns] of periodMap.entries()) {
      const expenses = txns.filter((t) => t.amount < 0);
      const income = txns.filter((t) => t.amount >= 0);

      const totalExpenses = Math.abs(
        expenses.reduce((sum, t) => sum + t.amount, 0)
      );
      const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);

      trends.push({
        period,
        totalExpenses,
        totalIncome,
        netAmount: totalIncome - totalExpenses,
        transactionCount: txns.length,
      });
    }

    trends.sort((a, b) => a.period.localeCompare(b.period));

    this.logger.calculationLog('Expense trends calculated', {
      periodsCount: trends.length,
      granularity,
    });

    return trends;
  }

  calculateCategoryDistribution(
    accountIds: string[],
    dateRange: DateRange
  ): CategoryDistribution[] {
    this.logger.calculationLog('Calculating category distribution', {
      accountIds,
      dateRange,
    });

    const categoryTotals = this.transactionRepository.getTotalsByCategory(
      accountIds,
      dateRange.startDate,
      dateRange.endDate
    );

    const expenses = categoryTotals.filter((c) => c.total < 0);

    const totalExpenses = Math.abs(
      expenses.reduce((sum, c) => sum + c.total, 0)
    );

    const distribution: CategoryDistribution[] = expenses.map((cat) => ({
      category: cat.category,
      totalAmount: Math.abs(cat.total),
      percentage: totalExpenses > 0 ? (Math.abs(cat.total) / totalExpenses) * 100 : 0,
      transactionCount: cat.count,
    }));

    distribution.sort((a, b) => b.totalAmount - a.totalAmount);

    this.logger.calculationLog('Category distribution calculated', {
      categoriesCount: distribution.length,
      totalExpenses,
    });

    return distribution;
  }

  calculateSummary(accountIds: string[], dateRange: DateRange) {
    this.logger.calculationLog('Calculating analytics summary', {
      accountIds,
      dateRange,
    });

    const startTime = Date.now();

    const transactions = this.transactionRepository.findWithFilters({
      accountIds,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      status: 'completed',
    });

    const totalIncome = transactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const netIncome = totalIncome - totalExpenses;

    const summary = {
      totalIncome,
      totalExpenses,
      netIncome,
      transactionCount: transactions.length,
      accountCount: accountIds.length,
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString(),
    };

    const duration = Date.now() - startTime;

    this.logger.calculationLog('Analytics summary completed', {
      duration: `${duration}ms`,
      totalIncome,
      totalExpenses,
      netIncome,
      transactionCount: transactions.length,
    });

    return summary;
  }

  private normalizeMerchantName(description: string): string {
    return description
      .toLowerCase()
      .replace(/[0-9]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 50);
  }

  private getPeriodKey(date: Date, granularity: 'daily' | 'monthly'): string {
    if (granularity === 'daily') {
      return date.toISOString().split('T')[0];
    } else {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }
  }
}