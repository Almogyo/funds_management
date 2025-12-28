import { Logger } from '../utils/logger';
import { TransactionRepository } from '../repositories/transaction.repository';
import { AccountRepository } from '../repositories/account.repository';
import { Transaction, Account } from '../types';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface HighestExpense {
  transaction: Transaction;
  amount: number;
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
  profitTrend: number; // Cumulative profit: income - expenses (can be negative if losing money)
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
    private transactionRepository: TransactionRepository,
    private accountRepository: AccountRepository
  ) {}

  getLastDataUpdate(accountIds: string[]): Date | null {
    const accounts = this.accountRepository.findMultipleById(accountIds);
    if (accounts.length === 0) {
      return null;
    }

    const maxLastScraped = accounts
      .filter((a: Account) => a.lastScrapedAt)
      .reduce((max: Date, account: Account) => {
        if (!account.lastScrapedAt) return max;
        return account.lastScrapedAt > max ? account.lastScrapedAt : max;
      }, new Date(0));

    return maxLastScraped.getTime() > 0 ? maxLastScraped : null;
  }

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

    // Group by exact description AND exact amount (not normalized)
    // Key format: "description|amount" to ensure exact matches
    const transactionGroups = new Map<string, Transaction[]>();

    for (const txn of expenses) {
      // Use exact description and exact amount as the key
      const key = `${txn.description}|${Math.abs(txn.amount)}`;
      const existing = transactionGroups.get(key) || [];
      existing.push(txn);
      transactionGroups.set(key, existing);
    }

    const recurring: RecurringPayment[] = [];

    for (const [_key, txns] of transactionGroups.entries()) {
      // Only include if there are 2+ transactions with exact same description and amount
      if (txns.length >= 2) {
        const amount = Math.abs(txns[0].amount); // All amounts are the same, so use first one
        const lastTxn = txns.reduce((latest, t) => (t.date > latest.date ? t : latest));
        
        // Get the main category from the transactions
        // Try to find a transaction with a main category
        let categoryName = 'Uncategorized';
        for (const txn of txns) {
          const mainCategory = txn.categories.find((cat) => cat.isMain);
          if (mainCategory) {
            categoryName = mainCategory.categoryName;
            break;
          }
        }

        recurring.push({
          merchantName: txns[0].description, // Use exact description
          category: categoryName,
          amount: amount,
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

    // Sort periods chronologically BEFORE calculating cumulative profit
    const sortedPeriods = Array.from(periodMap.keys()).sort((a, b) => a.localeCompare(b));

    const trends: ExpenseTrend[] = [];
    let cumulativeProfit = 0; // Running total of profit across periods

    for (const period of sortedPeriods) {
      const txns = periodMap.get(period)!;
      const expenses = txns.filter((t) => t.amount < 0);
      const income = txns.filter((t) => t.amount >= 0);

      const totalExpenses = Math.abs(
        expenses.reduce((sum, t) => sum + t.amount, 0)
      );
      const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
      const periodProfit = totalIncome - totalExpenses;
      cumulativeProfit += periodProfit; // Add this period's profit to cumulative

      trends.push({
        period,
        totalExpenses,
        totalIncome,
        netAmount: totalIncome - totalExpenses,
        profitTrend: cumulativeProfit, // Cumulative profit trend line
        transactionCount: txns.length,
      });
    }

    this.logger.calculationLog('Expense trends calculated', {
      periodsCount: trends.length,
      granularity,
      finalCumulativeProfit: cumulativeProfit,
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

    // getTotalsByCategory now returns only expenses (amount < 0) pre-filtered
    const categoryTotals = this.transactionRepository.getTotalsByCategory(
      accountIds,
      dateRange.startDate,
      dateRange.endDate
    );

    const totalExpenses = Math.abs(
      categoryTotals.reduce((sum, c) => sum + c.total, 0)
    );

    const distribution: CategoryDistribution[] = categoryTotals.map((cat) => ({
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