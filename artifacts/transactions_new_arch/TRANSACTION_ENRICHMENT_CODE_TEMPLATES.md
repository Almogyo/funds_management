# Transaction Enrichment - Implementation Code Templates

This document provides ready-to-use TypeScript code templates for implementing the transaction enrichment architecture. Copy and adapt these as needed.

---

## 1. TransactionBase Abstract Class

**File:** `/service/src/models/transaction.base.ts`

```typescript
import crypto from 'crypto';

export enum TransactionType {
  Normal = 'normal',
  Installments = 'installments',
}

export enum TransactionStatus {
  Completed = 'completed',
  Pending = 'pending',
}

export enum TransactionSourceType {
  Bank = 'bank',
  CreditCard = 'credit_card',
}

export interface TransactionInstallments {
  number: number;
  total: number;
}

/**
 * Abstract base class for all transaction types.
 * 
 * Defines the common contract that all financial transaction sources must implement.
 * Enables polymorphic handling and vendor-specific enrichment via inheritance.
 */
export abstract class TransactionBase {
  // Common fields (all sources)
  abstract type: TransactionType;
  abstract date: Date;
  abstract processedDate: Date;
  abstract originalAmount: number;
  abstract originalCurrency: string;
  abstract chargedAmount: number;
  abstract chargedCurrency: string;
  abstract description: string;
  abstract memo?: string;
  abstract status: TransactionStatus;
  abstract identifier?: string | number;
  abstract installments?: TransactionInstallments;
  abstract rawJson: string;

  // Vendor identification (implementation specific)
  abstract get vendorId(): string;
  abstract get sourceType(): TransactionSourceType;

  /**
   * Vendor-specific categorization strategy.
   * Implementations should use their enrichment data to determine categories.
   * Return empty array if no vendor-specific categorization available.
   */
  abstract getVendorSpecificCategories(): Promise<string[]>;

  /**
   * Serialize enrichment data for persistence.
   * Implementations should return their vendor-specific enrichment fields.
   */
  abstract getEnrichmentData(): Record<string, any>;

  /**
   * Generate transaction hash for deduplication.
   * Uses date, amount, and description for consistency across vendors.
   */
  generateHash(): string {
    const content = `${this.date.toISOString()}-${this.chargedAmount}-${this.description}`;
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
  }
}
```

---

## 2. BankTransaction Class

**File:** `/service/src/models/transaction.bank.ts`

```typescript
import {
  TransactionBase,
  TransactionType,
  TransactionStatus,
  TransactionSourceType,
  TransactionInstallments,
} from './transaction.base';

export type BankVendorId =
  | 'hapoalim'
  | 'leumi'
  | 'discount'
  | 'mizrahi'
  | 'union'
  | 'massad'
  | 'yahav'
  | 'beinleumi'
  | 'otsarHahayal';

/**
 * Bank transaction model.
 * Used for all Israeli bank sources which provide minimal enrichment data.
 */
export class BankTransaction extends TransactionBase {
  // Vendor-specific optional fields
  checkNumber?: string;
  transactionCode?: string;
  merchantCode?: string;

  constructor(data: {
    type: TransactionType;
    date: Date;
    processedDate: Date;
    originalAmount: number;
    originalCurrency: string;
    chargedAmount: number;
    chargedCurrency: string;
    description: string;
    memo?: string;
    status: TransactionStatus;
    identifier?: string | number;
    installments?: TransactionInstallments;
    rawJson: string;
    vendorId: BankVendorId;
    checkNumber?: string;
    transactionCode?: string;
    merchantCode?: string;
  }) {
    super();
    this.type = data.type;
    this.date = data.date;
    this.processedDate = data.processedDate;
    this.originalAmount = data.originalAmount;
    this.originalCurrency = data.originalCurrency;
    this.chargedAmount = data.chargedAmount;
    this.chargedCurrency = data.chargedCurrency;
    this.description = data.description;
    this.memo = data.memo;
    this.status = data.status;
    this.identifier = data.identifier;
    this.installments = data.installments;
    this.rawJson = data.rawJson;
    this._vendorId = data.vendorId;
    this.checkNumber = data.checkNumber;
    this.transactionCode = data.transactionCode;
    this.merchantCode = data.merchantCode;
  }

  private _vendorId: BankVendorId;

  get vendorId(): string {
    return this._vendorId;
  }

  get sourceType(): TransactionSourceType {
    return TransactionSourceType.Bank;
  }

  async getVendorSpecificCategories(): Promise<string[]> {
    // Banks generally lack enrichment data
    return [];
  }

  getEnrichmentData(): Record<string, any> {
    return {
      checkNumber: this.checkNumber,
      transactionCode: this.transactionCode,
      merchantCode: this.merchantCode,
    };
  }
}
```

---

## 3. CreditCardTransaction Abstract Base

**File:** `/service/src/models/transaction.creditcard.ts`

```typescript
import {
  TransactionBase,
  TransactionSourceType,
} from './transaction.base';

export interface CreditCardEnrichment {
  // Base enrichment structure for all credit cards
  rawVendorCategory?: string;
  installmentInfo?: {
    number: number;
    total: number;
    planType?: string;
  };
}

/**
 * Abstract base for credit card transactions.
 * Provides common structure for vendor-specific credit card models.
 */
export abstract class CreditCardTransaction extends TransactionBase {
  // Common credit card fields
  abstract cardLast4Digits?: string;
  abstract cardIndex?: number;

  // Vendor-specific enrichment (implemented by subclasses)
  abstract enrichmentData: CreditCardEnrichment;

  get sourceType(): TransactionSourceType {
    return TransactionSourceType.CreditCard;
  }

  getEnrichmentData(): Record<string, any> {
    return this.enrichmentData;
  }
}
```

---

## 4. IsracardTransaction Class

**File:** `/service/src/models/transaction.isracard.ts`

```typescript
import { Logger } from '../utils/logger';
import {
  CreditCardTransaction,
  CreditCardEnrichment,
} from './transaction.creditcard';
import {
  TransactionType,
  TransactionStatus,
  TransactionInstallments,
} from './transaction.base';

export interface IsracardEnrichment extends CreditCardEnrichment {
  sector?: string; // e.g., "דלק ותחבורה", "בריאות ותזונה"
  voucherNumber: string; // voucherNumberRatz
  dealSumType?: string;
  isOutbound: boolean; // Forex indicator
}

/**
 * Isracard-specific transaction model.
 * Enriches with sector classification from Isracard's merchant database.
 */
export class IsracardTransaction extends CreditCardTransaction {
  type: TransactionType;
  date: Date;
  processedDate: Date;
  originalAmount: number;
  originalCurrency: string;
  chargedAmount: number;
  chargedCurrency: string;
  description: string;
  memo?: string;
  status: TransactionStatus;
  identifier?: string | number;
  installments?: TransactionInstallments;
  rawJson: string;
  cardLast4Digits?: string;
  cardIndex?: number;
  enrichmentData: IsracardEnrichment;

  private _vendorId = 'isracard' as const;

  constructor(
    data: {
      type: TransactionType;
      date: Date;
      processedDate: Date;
      originalAmount: number;
      originalCurrency: string;
      chargedAmount: number;
      chargedCurrency: string;
      description: string;
      memo?: string;
      status: TransactionStatus;
      identifier?: string | number;
      installments?: TransactionInstallments;
      rawJson: string;
      cardIndex?: number;
      cardLast4Digits?: string;
      enrichmentData: IsracardEnrichment;
    },
    private logger: Logger
  ) {
    super();
    this.type = data.type;
    this.date = data.date;
    this.processedDate = data.processedDate;
    this.originalAmount = data.originalAmount;
    this.originalCurrency = data.originalCurrency;
    this.chargedAmount = data.chargedAmount;
    this.chargedCurrency = data.chargedCurrency;
    this.description = data.description;
    this.memo = data.memo;
    this.status = data.status;
    this.identifier = data.identifier;
    this.installments = data.installments;
    this.rawJson = data.rawJson;
    this.cardIndex = data.cardIndex;
    this.cardLast4Digits = data.cardLast4Digits;
    this.enrichmentData = data.enrichmentData;
  }

  get vendorId(): string {
    return this._vendorId;
  }

  async getVendorSpecificCategories(): Promise<string[]> {
    // Implementation moved to separate mapper service
    // This is just the interface
    return [];
  }
}
```

---

## 5. MaxTransaction Class

**File:** `/service/src/models/transaction.max.ts`

```typescript
import { Logger } from '../utils/logger';
import {
  CreditCardTransaction,
  CreditCardEnrichment,
} from './transaction.creditcard';
import {
  TransactionType,
  TransactionStatus,
  TransactionInstallments,
} from './transaction.base';

export interface MaxEnrichment extends CreditCardEnrichment {
  maxCategoryId?: number; // Max's internal category ID (1-10+)
  arn?: string; // Acquirer Reference Number
  planTypeId?: number; // Transaction type: 2, 3, 5, etc.
  planName?: string; // "Installments", "Normal", etc.
}

/**
 * Max (Leumi Card) transaction model.
 * Enriches with pre-categorized data directly from Max's system.
 */
export class MaxTransaction extends CreditCardTransaction {
  type: TransactionType;
  date: Date;
  processedDate: Date;
  originalAmount: number;
  originalCurrency: string;
  chargedAmount: number;
  chargedCurrency: string;
  description: string;
  memo?: string;
  status: TransactionStatus;
  identifier?: string | number;
  installments?: TransactionInstallments;
  rawJson: string;
  cardLast4Digits?: string;
  cardIndex?: number;
  enrichmentData: MaxEnrichment;

  private _vendorId = 'max' as const;

  constructor(
    data: {
      type: TransactionType;
      date: Date;
      processedDate: Date;
      originalAmount: number;
      originalCurrency: string;
      chargedAmount: number;
      chargedCurrency: string;
      description: string;
      memo?: string;
      status: TransactionStatus;
      identifier?: string | number;
      installments?: TransactionInstallments;
      rawJson: string;
      cardLast4Digits?: string;
      cardIndex?: number;
      enrichmentData: MaxEnrichment;
    },
    private logger: Logger
  ) {
    super();
    this.type = data.type;
    this.date = data.date;
    this.processedDate = data.processedDate;
    this.originalAmount = data.originalAmount;
    this.originalCurrency = data.originalCurrency;
    this.chargedAmount = data.chargedAmount;
    this.chargedCurrency = data.chargedCurrency;
    this.description = data.description;
    this.memo = data.memo;
    this.status = data.status;
    this.identifier = data.identifier;
    this.installments = data.installments;
    this.rawJson = data.rawJson;
    this.cardLast4Digits = data.cardLast4Digits;
    this.cardIndex = data.cardIndex;
    this.enrichmentData = data.enrichmentData;
  }

  get vendorId(): string {
    return this._vendorId;
  }

  async getVendorSpecificCategories(): Promise<string[]> {
    // Implementation moved to separate mapper service
    return [];
  }
}
```

---

## 6. VisaCalTransaction Class

**File:** `/service/src/models/transaction.visacal.ts`

```typescript
import { Logger } from '../utils/logger';
import {
  CreditCardTransaction,
  CreditCardEnrichment,
} from './transaction.creditcard';
import {
  TransactionType,
  TransactionStatus,
  TransactionInstallments,
} from './transaction.base';

export interface VisaCalMerchantMetadata {
  merchantId: string;
  address: string;
  phoneNumber: string;
  branchCode: string;
}

export interface VisaCalEnrichment extends CreditCardEnrichment {
  merchantMetadata?: VisaCalMerchantMetadata;
  trnTypeCode?: string; // '5', '6', '8', '9' - transaction type
  trnInternalId?: string;
}

/**
 * Visa Cal transaction model.
 * Enriches with detailed merchant metadata for sophisticated categorization.
 */
export class VisaCalTransaction extends CreditCardTransaction {
  type: TransactionType;
  date: Date;
  processedDate: Date;
  originalAmount: number;
  originalCurrency: string;
  chargedAmount: number;
  chargedCurrency: string;
  description: string;
  memo?: string;
  status: TransactionStatus;
  identifier?: string | number;
  installments?: TransactionInstallments;
  rawJson: string;
  cardLast4Digits?: string;
  cardIndex?: number;
  enrichmentData: VisaCalEnrichment;

  private _vendorId = 'visaCal' as const;

  constructor(
    data: {
      type: TransactionType;
      date: Date;
      processedDate: Date;
      originalAmount: number;
      originalCurrency: string;
      chargedAmount: number;
      chargedCurrency: string;
      description: string;
      memo?: string;
      status: TransactionStatus;
      identifier?: string | number;
      installments?: TransactionInstallments;
      rawJson: string;
      cardLast4Digits?: string;
      cardIndex?: number;
      enrichmentData: VisaCalEnrichment;
    },
    private logger: Logger
  ) {
    super();
    this.type = data.type;
    this.date = data.date;
    this.processedDate = data.processedDate;
    this.originalAmount = data.originalAmount;
    this.originalCurrency = data.originalCurrency;
    this.chargedAmount = data.chargedAmount;
    this.chargedCurrency = data.chargedCurrency;
    this.description = data.description;
    this.memo = data.memo;
    this.status = data.status;
    this.identifier = data.identifier;
    this.installments = data.installments;
    this.rawJson = data.rawJson;
    this.cardLast4Digits = data.cardLast4Digits;
    this.cardIndex = data.cardIndex;
    this.enrichmentData = data.enrichmentData;
  }

  get vendorId(): string {
    return this._vendorId;
  }

  async getVendorSpecificCategories(): Promise<string[]> {
    // Implementation moved to separate mapper service
    return [];
  }
}
```

---

## 7. TransactionFactory

**File:** `/service/src/factories/transaction.factory.ts`

```typescript
import { Logger } from '../utils/logger';
import {
  TransactionBase,
  TransactionType,
  TransactionStatus,
} from '../models/transaction.base';
import { BankTransaction } from '../models/transaction.bank';
import { IsracardTransaction } from '../models/transaction.isracard';
import { MaxTransaction } from '../models/transaction.max';
import { VisaCalTransaction } from '../models/transaction.visacal';
import { AmexTransaction } from '../models/transaction.amex';

/**
 * Factory for creating vendor-specific transaction instances.
 * Handles mapping from raw scraper data to typed domain models.
 */
export class TransactionFactory {
  constructor(private logger: Logger) {}

  createTransaction(
    rawTransaction: any,
    vendorId: string,
    accountId: string,
    rawJson: string
  ): TransactionBase {
    // Base fields common to all sources
    const baseFields = {
      type: rawTransaction.type === 'installments'
        ? TransactionType.Installments
        : TransactionType.Normal,
      date: this.normalizeDate(rawTransaction.date),
      processedDate: this.normalizeDate(rawTransaction.processedDate),
      originalAmount: rawTransaction.originalAmount,
      originalCurrency: rawTransaction.originalCurrency,
      chargedAmount: rawTransaction.chargedAmount,
      chargedCurrency: rawTransaction.chargedCurrency || rawTransaction.originalCurrency,
      description: rawTransaction.description?.trim() || 'Unknown',
      memo: rawTransaction.memo || undefined,
      status: this.normalizeStatus(rawTransaction.status),
      identifier: rawTransaction.identifier,
      installments: rawTransaction.installments,
      rawJson,
    };

    // Vendor-specific mapping
    switch (vendorId) {
      case 'isracard':
        return new IsracardTransaction(
          {
            ...baseFields,
            cardIndex: rawTransaction.cardIndex,
            cardLast4Digits: rawTransaction.cardNumber?.slice(-4),
            enrichmentData: {
              sector: rawTransaction.sector,
              voucherNumber: rawTransaction.voucherNumberRatz,
              isOutbound: rawTransaction.dealSumOutbound || false,
              dealSumType: rawTransaction.dealSumType,
            },
          },
          this.logger
        );

      case 'amex':
        return new AmexTransaction(
          {
            ...baseFields,
            cardIndex: rawTransaction.cardIndex,
            cardLast4Digits: rawTransaction.cardNumber?.slice(-4),
            enrichmentData: {
              sector: rawTransaction.sector,
              voucherNumber: rawTransaction.voucherNumberRatz,
              isOutbound: rawTransaction.dealSumOutbound || false,
              dealSumType: rawTransaction.dealSumType,
            },
          },
          this.logger
        );

      case 'max':
        return new MaxTransaction(
          {
            ...baseFields,
            cardLast4Digits: rawTransaction.shortCardNumber?.slice(-4),
            enrichmentData: {
              maxCategoryId: rawTransaction.categoryId,
              arn: rawTransaction.dealData?.arn,
              planTypeId: rawTransaction.planTypeId,
              planName: rawTransaction.planName,
            },
          },
          this.logger
        );

      case 'visaCal':
        return new VisaCalTransaction(
          {
            ...baseFields,
            cardLast4Digits: rawTransaction.cardNumber?.slice(-4),
            enrichmentData: {
              merchantMetadata: {
                merchantId: rawTransaction.merchantID,
                address: rawTransaction.merchantAddress,
                phoneNumber: rawTransaction.merchantPhoneNo,
                branchCode: rawTransaction.branchCodeDesc,
              },
              trnTypeCode: rawTransaction.trnTypeCode,
              trnInternalId: rawTransaction.trnIntId,
            },
          },
          this.logger
        );

      // Default: all banks and unknown vendors
      default:
        return new BankTransaction({
          ...baseFields,
          vendorId: vendorId as any,
        });
    }
  }

  private normalizeDate(date: string | Date): Date {
    if (typeof date === 'string') {
      return new Date(date);
    }
    return date;
  }

  private normalizeStatus(status: string): TransactionStatus {
    return status === 'pending'
      ? TransactionStatus.Pending
      : TransactionStatus.Completed;
  }
}
```

---

## 8. Category Mapper (Isracard)

**File:** `/service/src/mappers/isracard-category.mapper.ts`

```typescript
import { CategoryRepository } from '../repositories/category.repository';
import { Logger } from '../utils/logger';

/**
 * Maps Isracard Hebrew sector names to internal category system.
 * Maintains mapping between vendor categorization and our category IDs.
 */
export class IsracardCategoryMapper {
  // Mapping from Hebrew sector names to our category names
  private static readonly SECTOR_MAPPING: Record<string, string[]> = {
    'דלק ותחבורה': ['Transportation', 'Gas & Fuel'],
    'מסעדות ובר': ['Dining & Restaurants'],
    'בריאות ותזונה': ['Health & Wellness', 'Pharmacy'],
    'קניות': ['Shopping', 'Retail'],
    'תרבות וקולנוע': ['Entertainment', 'Culture'],
    'תיירות ומלונות': ['Travel', 'Hotels'],
    'טלקום ומדיה': ['Communications', 'Utilities'],
    'גז וחשמל': ['Utilities'],
    'ביטוח': ['Insurance'],
    'בנקים': ['Finance', 'Banking'],
    'ספורט וכושר': ['Sports & Fitness'],
    'ילדים ותינוקות': ['Shopping'],
    'בית וגינה': ['Home & Garden'],
    'חינוך': ['Education'],
    'אופנה': ['Shopping', 'Retail'],
    'ניקיון וכביסה': ['Home & Garden'],
    'חיות מחמד': ['Pets'],
    'כלים כחומרים': ['Home & Garden'],
    'תוכניות נאמנות': ['Shopping'],
    'אחר': ['Other'],
  };

  constructor(
    private categoryRepository: CategoryRepository,
    private logger: Logger
  ) {}

  /**
   * Map Isracard sector to internal category IDs.
   */
  async mapSectorToCategories(sector: string): Promise<string[]> {
    if (!sector) {
      return [];
    }

    const hebrewSector = sector.trim();
    const categoryNames = IsracardCategoryMapper.SECTOR_MAPPING[hebrewSector] || [];

    if (categoryNames.length === 0) {
      this.logger.warn(`Unknown Isracard sector`, {
        sector: hebrewSector,
      });
      return [];
    }

    const categoryIds: string[] = [];
    for (const name of categoryNames) {
      const category = this.categoryRepository.findByName(name);
      if (category) {
        categoryIds.push(category.id);
      } else {
        this.logger.warn(`Category not found`, {
          categoryName: name,
          isracardSector: hebrewSector,
        });
      }
    }

    return categoryIds;
  }

  /**
   * Add or update a sector mapping.
   * Could be called from admin API for maintenance.
   */
  addSectorMapping(hebrewSector: string, categoryNames: string[]): void {
    IsracardCategoryMapper.SECTOR_MAPPING[hebrewSector] = categoryNames;
  }
}
```

---

## 9. Category Mapper (Max)

**File:** `/service/src/mappers/max-category.mapper.ts`

```typescript
import { CategoryRepository } from '../repositories/category.repository';
import { Logger } from '../utils/logger';

/**
 * Maps Max category IDs to internal category system.
 * Max provides pre-categorized transactions, we map to our system.
 */
export class MaxCategoryMapper {
  // Mapping from Max category IDs to our category names
  private static readonly CATEGORY_ID_MAPPING: Record<number, string[]> = {
    1: ['Shopping', 'Retail'],
    2: ['Dining & Restaurants'],
    3: ['Entertainment', 'Culture'],
    4: ['Travel', 'Hotels'],
    5: ['Health & Wellness'],
    6: ['Transportation', 'Gas & Fuel'],
    7: ['Utilities'],
    8: ['Communications'],
    9: ['Insurance'],
    10: ['Finance', 'Banking'],
    // Add more mappings as needed based on Max's category system
  };

  constructor(
    private categoryRepository: CategoryRepository,
    private logger: Logger
  ) {}

  /**
   * Map Max category ID to internal category IDs.
   */
  async mapCategoryIdToCategories(categoryId: number): Promise<string[]> {
    if (!categoryId) {
      return [];
    }

    const categoryNames = MaxCategoryMapper.CATEGORY_ID_MAPPING[categoryId] || [];

    if (categoryNames.length === 0) {
      this.logger.warn(`Unknown Max category ID`, {
        maxCategoryId: categoryId,
      });
      return [];
    }

    const categoryIds: string[] = [];
    for (const name of categoryNames) {
      const category = this.categoryRepository.findByName(name);
      if (category) {
        categoryIds.push(category.id);
      } else {
        this.logger.warn(`Category not found`, {
          categoryName: name,
          maxCategoryId: categoryId,
        });
      }
    }

    return categoryIds;
  }

  /**
   * Add or update a category mapping.
   */
  addCategoryMapping(maxCategoryId: number, categoryNames: string[]): void {
    MaxCategoryMapper.CATEGORY_ID_MAPPING[maxCategoryId] = categoryNames;
  }
}
```

---

## 10. Updated CategorizationService

**File:** `/service/src/services/categorization.service.ts` (excerpt)

```typescript
import { Logger } from '../utils/logger';
import { CategoryRepository } from '../repositories/category.repository';
import { TransactionBase, CreditCardTransaction } from '../models';
import { IsracardTransaction } from '../models/transaction.isracard';
import { MaxTransaction } from '../models/transaction.max';
import { IsracardCategoryMapper } from '../mappers/isracard-category.mapper';
import { MaxCategoryMapper } from '../mappers/max-category.mapper';

export class CategorizationService {
  private isracardMapper: IsracardCategoryMapper;
  private maxMapper: MaxCategoryMapper;

  constructor(
    private logger: Logger,
    private categoryRepository: CategoryRepository
  ) {
    this.isracardMapper = new IsracardCategoryMapper(
      categoryRepository,
      logger
    );
    this.maxMapper = new MaxCategoryMapper(categoryRepository, logger);
  }

  /**
   * Multi-strategy categorization:
   * 1. Try vendor-specific enrichment
   * 2. Fall back to keyword matching
   * 3. Use Unknown category
   */
  async categorizeTransaction(transaction: TransactionBase): Promise<string[]> {
    this.logger.debug(`Categorizing transaction`, {
      description: transaction.description,
      vendor: transaction.vendorId,
      hasEnrichment: transaction instanceof CreditCardTransaction,
    });

    // Step 1: Vendor-specific categorization
    if (transaction instanceof IsracardTransaction) {
      if (transaction.enrichmentData.sector) {
        const categories = await this.isracardMapper.mapSectorToCategories(
          transaction.enrichmentData.sector
        );
        if (categories.length > 0) {
          this.logger.debug(`Used Isracard sector categorization`, {
            categories,
            sector: transaction.enrichmentData.sector,
          });
          return categories;
        }
      }
    }

    if (transaction instanceof MaxTransaction) {
      if (transaction.enrichmentData.maxCategoryId) {
        const categories = await this.maxMapper.mapCategoryIdToCategories(
          transaction.enrichmentData.maxCategoryId
        );
        if (categories.length > 0) {
          this.logger.debug(`Used Max category categorization`, {
            categories,
            maxCategoryId: transaction.enrichmentData.maxCategoryId,
          });
          return categories;
        }
      }
    }

    // Step 2: Keyword-based categorization (existing logic)
    const keywordCategories = this.categorizeByKeywords(
      transaction.description
    );
    if (keywordCategories.length > 0) {
      this.logger.debug(`Used keyword-based categorization`, {
        categories: keywordCategories,
      });
      return keywordCategories;
    }

    // Step 3: Use Unknown category
    const unknownCategory = this.categoryRepository.findByName('Unknown');
    if (unknownCategory) {
      return [unknownCategory.id];
    }

    return [];
  }

  private categorizeByKeywords(description: string): string[] {
    const normalizedDescription = this.normalizeText(description);
    const matchedCategoryIds: string[] = [];

    const categories = this.categoryRepository.list();
    for (const category of categories) {
      if (category.name === 'Unknown') continue;
      if (category.keywords.length === 0) continue;

      for (const keyword of category.keywords) {
        const normalizedKeyword = this.normalizeText(keyword);
        if (this.exactMatch(normalizedDescription, normalizedKeyword)) {
          matchedCategoryIds.push(category.id);
          break; // Move to next category
        }
      }
    }

    return matchedCategoryIds;
  }

  private normalizeText(text: string): string {
    return text.toLowerCase().trim();
  }

  private exactMatch(text: string, keyword: string): boolean {
    return text.includes(keyword);
  }
}
```

---

## 11. SQL Migration

**File:** `/service/migrations/add_enrichment_data.sql`

```sql
-- Add enrichment_data column to transactions table
ALTER TABLE transactions 
ADD COLUMN enrichment_data JSONB DEFAULT '{}';

-- Create index for efficient JSONB queries
CREATE INDEX idx_transactions_enrichment_data 
ON transactions USING GIN (enrichment_data jsonb_ops);

-- Create specific indexes for common enrichment lookups
CREATE INDEX idx_transactions_isracard_sector 
ON transactions USING GIN (enrichment_data jsonb_ops)
WHERE enrichment_data->>'sector' IS NOT NULL;

CREATE INDEX idx_transactions_max_category 
ON transactions USING GIN (enrichment_data jsonb_ops)
WHERE enrichment_data->>'maxCategoryId' IS NOT NULL;

-- Query examples:
-- SELECT * FROM transactions 
-- WHERE enrichment_data->>'sector' = 'דלק ותחבורה';

-- SELECT * FROM transactions 
-- WHERE enrichment_data->>'maxCategoryId' = '1';
```

---

## Notes for Implementation

1. **Replace Logger/Logger imports** with your actual Logger implementation
2. **Adjust date normalization** if needed based on your actual date formats
3. **Add proper error handling** for production use
4. **Consider transaction type exports** from your existing codebase
5. **Update TransactionRepository** to handle enrichment_data column
6. **Add comprehensive tests** for each model and mapper
7. **Create integration tests** with actual scraper data

---

## Import Statements (for reference)

```typescript
// In factory and services
import { TransactionBase } from '../models/transaction.base';
import { BankTransaction } from '../models/transaction.bank';
import { IsracardTransaction } from '../models/transaction.isracard';
import { MaxTransaction } from '../models/transaction.max';
import { VisaCalTransaction } from '../models/transaction.visacal';
import { AmexTransaction } from '../models/transaction.amex';
import { IsracardCategoryMapper } from '../mappers/isracard-category.mapper';
import { MaxCategoryMapper } from '../mappers/max-category.mapper';
import { Logger } from '../utils/logger';
import { CategoryRepository } from '../repositories/category.repository';
```

These templates are ready to adapt and implement. Adjust as needed for your specific codebase structure and conventions.
