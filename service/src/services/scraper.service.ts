import { createScraper, CompanyTypes, ScraperScrapingResult } from 'israeli-bank-scrapers';
import { Logger } from '../utils/logger';
import { CredentialData } from './credential.service';
import fs from 'fs';
import path from 'path';

export interface BankTransaction {
  type: string;
  date: string | Date;
  processedDate: string | Date;
  originalAmount: number;
  originalCurrency: string;
  chargedAmount: number;
  description: string;
  memo?: string;
  status: string;
  identifier?: string | number;
  installments?: {
    number: number;
    total: number;
  };
}

export interface ScraperOptions {
  startDate: Date;
  endDate?: Date;
  futureMonths?: number;
  combineInstallments?: boolean;
  timeout?: number;
  showBrowser?: boolean;
  screenshotPath?: string;
}

export interface ScraperResult {
  success: boolean;
  accountNumber?: string;
  transactionsCount: number;
  transactions: BankTransaction[];
  error?: string;
  duration: number;
  screenshotPath?: string;
  waitingForOTP?: boolean;
  otpType?: 'SMS' | 'APP';
}

export class ScraperService {
  constructor(
    private logger: Logger,
    private screenshotPath: string = './screenshots'
  ) {
    this.ensureScreenshotDirectory();
  }

  private ensureScreenshotDirectory(): void {
    if (!fs.existsSync(this.screenshotPath)) {
      fs.mkdirSync(this.screenshotPath, { recursive: true });
    }
  }

  async scrape(
    companyId: string,
    accountName: string,
    credentials: CredentialData,
    options: ScraperOptions
  ): Promise<ScraperResult> {
    const startTime = Date.now();

    this.logger.scraperLog(`Starting scrape`, accountName, {
      companyId,
      startDate: options.startDate.toISOString(),
      endDate: options.endDate?.toISOString(),
    });

    try {
      // Credit card scrapers (especially Isracard) may need more time for navigation
      // Banks also need sufficient timeout for browser-based authentication
      // Default timeout: 3 minutes for credit cards, 3 minutes for banks (increased for browser login)
      const isCreditCard = ['isracard', 'amex', 'visaCal', 'max'].includes(companyId);
      const defaultTimeout = isCreditCard ? 180000 : 180000; // 3 min for both (banks need more time for browser login)
      
      const scraperOptions: any = {
        companyId: this.getCompanyType(companyId),
        startDate: options.startDate,
        futureMonthsToScrape: options.futureMonths || 0,
        combineInstallments: options.combineInstallments || false,
        timeout: options.timeout || defaultTimeout,
        verbose: false,
        showBrowser: options.showBrowser !== undefined ? options.showBrowser : true,
        // Enable built-in enrichment for Isracard/Amex (fetches sector data via getExtraScrapTransaction)
        additionalTransactionInformation: ['isracard', 'amex'].includes(companyId),
      };

      // Add navigation timeout option for all scrapers (banks and credit cards)
      // This helps with slow-loading login pages and login wizards
      // Banks (like Hapoalim, Leumi) also need this timeout for their browser-based authentication
      scraperOptions.navigationTimeout = 60000; // 60 seconds for navigation

      this.logger.scraperLog(`Scraper timeout set`, accountName, {
        companyId,
        timeout: scraperOptions.timeout,
        navigationTimeout: scraperOptions.navigationTimeout,
        isCreditCard,
        additionalTransactionInformation: scraperOptions.additionalTransactionInformation,
      });

      this.logger.scraperLog(`Creating scraper instance`, accountName, {
        companyId,
        options: scraperOptions,
      });

      const scraper = createScraper(scraperOptions);

      scraper.onProgress((companyId: string, payload: any) => {
        this.logger.scraperLog(`Progress: ${payload.type}`, accountName, {
          companyId,
          stage: payload.type,
        });
      });

      // Log credential structure (without sensitive values) for debugging
      const credentialKeys = Object.keys(credentials);
      const credentialStructure = credentialKeys.reduce((acc, key) => {
        const value = credentials[key];
        if (value) {
          // Show length and first/last char for verification (not full value)
          const str = String(value);
          acc[key] = `[${str.length} chars, starts: ${str[0]}, ends: ${str[str.length - 1]}]`;
        } else {
          acc[key] = 'missing';
        }
        return acc;
      }, {} as Record<string, string>);
      
      this.logger.scraperLog(`Executing scrape with credentials`, accountName, { 
        companyId,
        credentialFields: credentialKeys,
        credentialStructure,
        hasId: !!credentials.id,
        hasCard6Digits: !!credentials.card6Digits,
        hasPassword: !!credentials.password,
        hasUsername: !!credentials.username,
      });

      const result: ScraperScrapingResult = await scraper.scrape(credentials as any);

      const duration = Date.now() - startTime;

      if (!result.success) {
        this.logger.scraperLog(`Scraping failed`, accountName, {
          companyId,
          errorType: result.errorType,
          errorMessage: result.errorMessage,
          duration: `${duration}ms`,
        });

        return {
          success: false,
          transactionsCount: 0,
          transactions: [],
          error: result.errorMessage || 'Unknown error',
          duration,
        };
      }

      const allTransactions: BankTransaction[] = [];
      let primaryAccountNumber = '';

      if (result.accounts && result.accounts.length > 0) {
        for (const account of result.accounts) {
          if (!primaryAccountNumber) {
            primaryAccountNumber = account.accountNumber;
          }

          if (account.txns) {
            allTransactions.push(...account.txns);
          }

          this.logger.scraperLog(`Retrieved account data`, accountName, {
            companyId,
            accountNumber: account.accountNumber,
            transactionCount: account.txns?.length || 0,
            balance: account.balance,
          });
        }
      }

      this.logger.scraperLog(`Scraping completed successfully`, accountName, {
        companyId,
        accountsCount: result.accounts?.length || 0,
        totalTransactions: allTransactions.length,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        accountNumber: primaryAccountNumber,
        transactionsCount: allTransactions.length,
        transactions: allTransactions,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.scraperLog(`Scraping failed with exception`, accountName, {
        companyId,
        error: errorMessage,
        duration: `${duration}ms`,
      });

      let screenshotPath: string | undefined;
      if (options.screenshotPath) {
        try {
          screenshotPath = path.join(
            this.screenshotPath,
            `${companyId}_${accountName}_${Date.now()}.png`
          );
          this.logger.scraperLog(`Screenshot saved`, accountName, {
            companyId,
            screenshotPath,
          });
        } catch (screenshotError) {
          this.logger.error(`Failed to save screenshot: ${screenshotError}`);
        }
      }

      return {
        success: false,
        transactionsCount: 0,
        transactions: [],
        error: errorMessage,
        duration,
        screenshotPath,
      };
    }
  }

  private getCompanyType(companyId: string): CompanyTypes {
    const mapping: Record<string, CompanyTypes> = {
      hapoalim: CompanyTypes.hapoalim,
      leumi: CompanyTypes.leumi,
      discount: CompanyTypes.discount,
      mizrahi: CompanyTypes.mizrahi,
      union: CompanyTypes.union,
      massad: CompanyTypes.massad,
      visaCal: CompanyTypes.visaCal,
      max: CompanyTypes.max,
      isracard: CompanyTypes.isracard,
      amex: CompanyTypes.amex,
    };

    return mapping[companyId] || CompanyTypes.leumi;
  }

  async scrapeMultiple(
    accounts: Array<{
      companyId: string;
      accountName: string;
      credentials: CredentialData;
    }>,
    options: ScraperOptions,
    maxParallel: number = 2
  ): Promise<ScraperResult[]> {
    this.logger.scraperLog(`Starting batch scrape`, 'BATCH', {
      accountsCount: accounts.length,
      maxParallel,
    });

    const results: ScraperResult[] = [];
    const chunks: Array<typeof accounts> = [];

    for (let i = 0; i < accounts.length; i += maxParallel) {
      chunks.push(accounts.slice(i, i + maxParallel));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((account) =>
          this.scrape(account.companyId, account.accountName, account.credentials, options)
        )
      );
      results.push(...chunkResults);
    }

    const successCount = results.filter((r) => r.success).length;
    const totalTransactions = results.reduce((sum, r) => sum + r.transactionsCount, 0);

    this.logger.scraperLog(`Batch scrape completed`, 'BATCH', {
      totalAccounts: accounts.length,
      successfulAccounts: successCount,
      failedAccounts: accounts.length - successCount,
      totalTransactions,
    });

    return results;
  }
}
