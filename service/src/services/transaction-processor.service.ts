import { BankTransaction } from './scraper.service';
import { Logger } from '../utils/logger';
import crypto from 'crypto';

export interface ProcessedTransaction {
  txnHash: string;
  date: Date;
  processedDate: Date;
  amount: number;
  currency: string;
  description: string;
  status: 'completed' | 'pending';
  installmentNumber: number | null;
  installmentTotal: number | null;
  identifier: string | null;
  rawJson: string;
}

export class TransactionProcessorService {
  constructor(private logger: Logger) {}

  processTransactions(
    transactions: BankTransaction[],
    accountId: string
  ): ProcessedTransaction[] {
    this.logger.dbLog(`Processing ${transactions.length} transactions`, {
      accountId,
      transactionCount: transactions.length,
    });

    const processed: ProcessedTransaction[] = [];
    const seenHashes = new Set<string>();

    for (const txn of transactions) {
      try {
        const processedTxn = this.processTransaction(txn, accountId);

        if (seenHashes.has(processedTxn.txnHash)) {
          this.logger.debug(`Duplicate transaction detected, skipping`, {
            txnHash: processedTxn.txnHash,
            description: processedTxn.description,
          });
          continue;
        }

        seenHashes.add(processedTxn.txnHash);
        processed.push(processedTxn);
      } catch (error) {
        this.logger.warn(`Failed to process transaction`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          transaction: txn,
        });
      }
    }

    this.logger.dbLog(`Processed ${processed.length} unique transactions`, {
      accountId,
      originalCount: transactions.length,
      processedCount: processed.length,
      duplicatesSkipped: transactions.length - processed.length,
    });

    return processed;
  }

  private processTransaction(txn: BankTransaction, accountId: string): ProcessedTransaction {
    const date = this.normalizeDate(txn.date);
    const processedDate = this.normalizeDate(txn.processedDate);

    const amount = txn.chargedAmount || txn.originalAmount;
    const currency = this.normalizeCurrency(txn.originalCurrency);

    const status = this.normalizeStatus(txn.status);

    const installmentNumber = txn.installments?.number || null;
    const installmentTotal = txn.installments?.total || null;

    const identifier = txn.identifier ? String(txn.identifier) : null;

    const txnHash = this.generateTransactionHash(
      accountId,
      date,
      amount,
      txn.description,
      identifier
    );

    return {
      txnHash,
      date,
      processedDate,
      amount,
      currency,
      description: txn.description.trim(),
      status,
      installmentNumber,
      installmentTotal,
      identifier,
      rawJson: JSON.stringify(txn),
    };
  }

  private normalizeDate(date: string | Date): Date {
    if (date instanceof Date) {
      return date;
    }

    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid date: ${date}`);
    }

    return parsed;
  }

  private normalizeCurrency(currency: string): string {
    const currencyMap: Record<string, string> = {
      ILS: 'ILS',
      '₪': 'ILS',
      USD: 'USD',
      $: 'USD',
      EUR: 'EUR',
      '€': 'EUR',
      GBP: 'GBP',
      '£': 'GBP',
    };

    return currencyMap[currency.toUpperCase()] || currency.toUpperCase();
  }

  private normalizeStatus(status: string): 'completed' | 'pending' {
    const completedStatuses = ['completed', 'done', 'cleared', 'posted'];
    const pendingStatuses = ['pending', 'processing', 'authorized'];

    const statusLower = status.toLowerCase();

    if (completedStatuses.includes(statusLower)) {
      return 'completed';
    }

    if (pendingStatuses.includes(statusLower)) {
      return 'pending';
    }

    return 'completed';
  }

  private generateTransactionHash(
    accountId: string,
    date: Date,
    amount: number,
    description: string,
    identifier: string | null
  ): string {
    const hashInput = [
      accountId,
      date.toISOString().split('T')[0],
      amount.toFixed(2),
      description.trim().toLowerCase(),
      identifier || '',
    ].join('|');

    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  convertCurrencyToILS(amount: number, currency: string, exchangeRates?: Record<string, number>): number {
    if (currency === 'ILS') {
      return amount;
    }

    const defaultRates: Record<string, number> = {
      USD: 3.6,
      EUR: 3.9,
      GBP: 4.5,
    };

    const rates = exchangeRates || defaultRates;
    const rate = rates[currency];

    if (!rate) {
      this.logger.warn(`Unknown currency ${currency}, returning original amount`);
      return amount;
    }

    return amount * rate;
  }
}
