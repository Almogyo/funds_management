# Transaction Enrichment Architecture Plan
## funds_management Project - Credit Card & Multi-Source Enhanced Scraping

**Status**: Architecture Planning Phase  
**Date**: December 16, 2025  
**Scope**: Multi-vendor transaction enrichment with vendor-specific categorization

---

## Executive Summary

This document outlines a comprehensive architectural plan to enhance the funds_management system's transaction handling by implementing a hierarchical transaction model that supports vendor-specific enrichment. The system currently scrapes financial data from Israeli banks and credit card companies using the `israeli-bank-scrapers` library (v6.3.1). This enhancement will enable:

1. **Vendor-specific transaction models** with enriched fields beyond standard banking data
2. **Extensible categorization logic** that leverages vendor-specific enrichment data
3. **Future-proof architecture** supporting new financial sources with minimal code changes
4. **Backward compatibility** with existing BankTransaction implementations

---

## Current State Analysis

### Existing Architecture

**Transaction Flow:**
```
israeli-bank-scrapers (raw BankTransaction)
         ↓
TransactionProcessorService (ProcessedTransaction)
         ↓
TransactionRepository (persisted as Transaction)
         ↓
CategorizationService (auto-categorization by description)
```

**Current Limitations:**
- Single BankTransaction interface applies uniformly to all sources
- Only standard fields captured: `date`, `amount`, `description`, `memo`, `identifier`, `installments`
- Categorization logic is text-based (keyword matching on description only)
- No vendor-specific enrichment data is extracted/stored
- No mechanism to leverage additional available data for smarter categorization

### Supported Vendors & Their Enrichment Data

#### **Credit Card Companies**

| Vendor | Enrichment Available | Current Usage | Additional Data |
|--------|----------------------|---------------|-----------------|
| **Isracard** | ✅ Sector/Category ID | Raw scrape only | `PirteyIska_204Bean.sector` - Merchant sector classification |
| **Amex** | ✅ Card-specific data | Raw scrape only | Inherits Isracard base scraper, same sector data |
| **Max** | ✅ ARN, Deal Data, Category ID | Partially used | `dealData.arn`, `categoryId`, `planTypeId` (transaction type) |
| **Visa Cal** | ✅ Merchant metadata | Raw scrape only | `merchantID`, `merchantAddress`, `merchantPhoneNo`, `branchCodeDesc` |

#### **Banks**

| Vendor | Enrichment Available | Usage |
|--------|----------------------|-------|
| **Hapoalim, Leumi, etc.** | Limited | Basic transaction fields only |
| **Mizrahi** | ✅ Transaction codes | Extra API calls for details via `MC02KodGoremEZ` |
| **Union Bank** | ✅ Reference/check details | Parsed from transaction fields |

---

## Vendor-Specific Enrichment Data Deep Dive

### Isracard (COMPANY_CODE: "11")

**Raw Scraped Transaction Fields:**
```typescript
{
  dealSumType: string;
  voucherNumberRatz: string;        // Identifier
  dealSum: number;
  paymentSum: number;
  fullSupplierNameHeb: string;      // Description
  fullPurchaseDate: string;
  fullPaymentDate?: string;
  currencyId: string;               // Currency
  moreInfo?: string;                // Contains installment info
  dealSumOutbound: boolean;          // Forex transaction indicator
  fullSupplierNameOutbound?: string; // Forex supplier name
}
```

**Additional Enrichment via `getExtraScrapTransaction()`:**
- **API Endpoint**: `PirteyIska_204` request
- **Available Data**: 
  - `sector`: Merchant sector classification (e.g., "בריאות ותזונה", "תחבורה")
  - This is fetched per transaction after initial scrape
  - Provides vendor-level categorization pre-built into Isracard's system

**Example Flow:**
```
Transaction: {voucherNumberRatz: "1234567", fullSupplierNameHeb: "דלק מחלקה 5"}
             ↓ (second request to API with moedChiuv, shovarRatz)
Enhanced: {voucherNumberRatz: "1234567", sector: "דלק ותחבורה"}
```

### Max (Leumi Card)

**Raw Scraped Transaction Fields:**
```typescript
{
  shortCardNumber: string;
  purchaseDate: string;
  paymentDate?: string;
  actualPaymentAmount: string;
  originalAmount: number;
  merchantName: string;              // Description
  categoryId: number;                 // Pre-categorized!
  planTypeId: number;                // Transaction type indicator
  planName: string;                  // "Installments", "Normal", etc.
  comments: string;                  // May contain payment details
  dealData?: {
    arn: string;                      // Acquirer Reference Number
  };
}
```

**Enrichment Characteristics:**
- **Built-in Category**: `categoryId` is provided by Max's system
- **Transaction Classification**: `planTypeId` indicates installment vs. normal
- **Merchant Reference**: `arn` enables linking to merchant networks
- **No additional API calls needed** (unlike Isracard)

### Visa Cal

**Raw Scraped Transaction Fields:**
```typescript
{
  merchantName: string;              // Description
  merchantID: string;                // Merchant network ID
  merchantAddress: string;           // Physical address
  merchantPhoneNo: string;            // Contact info
  trnPurchaseDate: string;
  trnAmt: number;
  trnCurrencySymbol: string;
  trnTypeCode: '5'|'6'|'8'|'9';      // Regular, Credit, Installments, Standing Order
  branchCodeDesc: string;             // Branch/merchant category
  debCrdDate: string;                // Charge date
  trnIntId: string;                  // Internal transaction ID
}
```

**Enrichment Characteristics:**
- **Merchant metadata**: Full contact and location info enables MCC/category lookup
- **Detailed transaction type**: Code-based classification
- **No additional API calls needed**

---

## Proposed Architecture

### 1. Transaction Model Hierarchy

#### **Base Transaction Class**
```typescript
// service/src/models/transaction.base.ts

/**
 * Abstract base class for all transaction types.
 * Defines the common contract that all financial transaction sources must implement.
 * 
 * This enables:
 * - Polymorphic handling of different transaction sources
 * - Vendor-specific enrichment fields via extends
 * - Type-safe categorization leveraging source-specific data
 */
export abstract class TransactionBase {
  // Common fields (all sources)
  type: TransactionType;                    // 'normal' | 'installments'
  date: Date;                               // Transaction date
  processedDate: Date;                      // Settlement/posting date
  originalAmount: number;                   // Amount in original currency
  originalCurrency: string;                 // e.g., 'ILS', 'USD'
  chargedAmount: number;                    // Amount actually debited
  chargedCurrency: string;
  description: string;                      // Merchant/payee description
  memo?: string;                            // Optional memo/notes
  status: TransactionStatus;                // 'completed' | 'pending'
  identifier?: string | number;             // Transaction reference/check number
  installments?: {
    number: number;
    total: number;
  };

  // Vendor identification
  abstract vendorId: string;                // 'isracard', 'max', 'leumi', etc.
  abstract sourceType: TransactionSourceType; // 'bank' | 'credit_card'

  // Abstract method for vendor-specific categorization
  abstract getVendorSpecificCategories(): Promise<string[]>;

  // Abstract method for enrichment data serialization
  abstract getEnrichmentData(): Record<string, any>;
}
```

#### **Bank Transaction (existing pattern)**
```typescript
// service/src/models/transaction.bank.ts

export class BankTransaction extends TransactionBase {
  vendorId: 'hapoalim' | 'leumi' | 'discount' | 'mizrahi' | 'union' | 'massad' | 'yahav' | 'beinleumi' | 'otsarHahayal';
  sourceType: 'bank' = 'bank';

  // Bank-specific enrichment (optional)
  checkNumber?: string;
  transactionCode?: string;
  merchantCode?: string;

  async getVendorSpecificCategories(): Promise<string[]> {
    // Banks generally lack enrichment data; return empty array
    // Could be extended in future if bank APIs provide categorization
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

#### **Credit Card Transaction (new)**
```typescript
// service/src/models/transaction.creditcard.ts

export class CreditCardTransaction extends TransactionBase {
  vendorId: 'isracard' | 'amex' | 'max' | 'visaCal';
  sourceType: 'credit_card' = 'credit_card';

  // Credit-card specific fields
  cardLast4Digits?: string;
  cardIndex?: number;

  // Enrichment fields vary by vendor - see subclasses below
  abstract enrichmentData: CreditCardEnrichment;

  async getVendorSpecificCategories(): Promise<string[]> {
    // Implemented by vendor-specific subclasses
    return [];
  }

  getEnrichmentData(): Record<string, any> {
    return this.enrichmentData;
  }
}

export interface CreditCardEnrichment {
  // Base enrichment structure
  rawVendorCategory?: string;       // Vendor-provided category/sector
  installmentInfo?: {
    number: number;
    total: number;
    planType?: string;
  };
}
```

#### **Vendor-Specific Credit Card Transaction Models**

```typescript
// service/src/models/transaction.isracard.ts

export class IsracardTransaction extends CreditCardTransaction {
  vendorId: 'isracard' = 'isracard';

  enrichmentData: IsracardEnrichment;

  async getVendorSpecificCategories(): Promise<string[]> {
    // Isracard provides sector classification
    // Map Hebrew sector names to our category system
    if (this.enrichmentData.sector) {
      return await mapIsracardSectorToCategories(this.enrichmentData.sector);
    }
    return [];
  }
}

export interface IsracardEnrichment extends CreditCardEnrichment {
  sector?: string;                  // e.g., "דלק ותחבורה", "בריאות ותזונה"
  voucherNumber: string;            // voucherNumberRatz
  dealSumType?: string;
  isOutbound: boolean;              // Forex indicator
}
```

```typescript
// service/src/models/transaction.max.ts

export class MaxTransaction extends CreditCardTransaction {
  vendorId: 'max' = 'max';

  enrichmentData: MaxEnrichment;

  async getVendorSpecificCategories(): Promise<string[]> {
    // Max provides pre-categorized data
    if (this.enrichmentData.maxCategoryId) {
      return await mapMaxCategoryIdToCategories(this.enrichmentData.maxCategoryId);
    }
    return [];
  }
}

export interface MaxEnrichment extends CreditCardEnrichment {
  maxCategoryId?: number;           // Max's internal category ID
  arn?: string;                     // Acquirer Reference Number
  planTypeId?: number;              // 2, 3, 5 etc. for transaction classification
  planName?: string;                // "Installments", "Normal", etc.
}
```

```typescript
// service/src/models/transaction.visacal.ts

export class VisaCalTransaction extends CreditCardTransaction {
  vendorId: 'visaCal' = 'visaCal';

  enrichmentData: VisaCalEnrichment;

  async getVendorSpecificCategories(): Promise<string[]> {
    // Visa Cal provides merchant metadata
    if (this.enrichmentData.merchantMetadata) {
      return await mapVisaCalMerchantToCategories(
        this.enrichmentData.merchantMetadata
      );
    }
    return [];
  }
}

export interface VisaCalEnrichment extends CreditCardEnrichment {
  merchantMetadata?: {
    merchantId: string;
    address: string;
    phoneNumber: string;
    branchCode: string;
  };
  trnTypeCode?: string;             // '5', '6', '8', '9'
  trnInternalId?: string;
}
```

```typescript
// service/src/models/transaction.amex.ts

export class AmexTransaction extends CreditCardTransaction {
  vendorId: 'amex' = 'amex';

  // Amex shares base scraper with Isracard
  enrichmentData: IsracardEnrichment;

  async getVendorSpecificCategories(): Promise<string[]> {
    // Amex inherits Isracard's sector classification
    if (this.enrichmentData.sector) {
      return await mapAmexSectorToCategories(this.enrichmentData.sector);
    }
    return [];
  }
}
```

---

### 2. Factory Pattern for Transaction Adaptation

```typescript
// service/src/factories/transaction.factory.ts

import { BankTransaction, CreditCardTransaction, IsracardTransaction, MaxTransaction, VisaCalTransaction, AmexTransaction } from '../models';
import { ScraperService } from '../services/scraper.service';

export class TransactionFactory {
  /**
   * Converts raw scraped transaction to appropriate domain model.
   * Handles vendor-specific enrichment field mapping.
   */
  static createTransaction(
    rawTransaction: any,
    vendorId: string,
    accountId: string,
    rawJson: string
  ): TransactionBase {
    const baseFields = {
      date: this.normalizeDate(rawTransaction.date),
      processedDate: this.normalizeDate(rawTransaction.processedDate),
      originalAmount: rawTransaction.originalAmount,
      originalCurrency: rawTransaction.originalCurrency,
      chargedAmount: rawTransaction.chargedAmount,
      chargedCurrency: rawTransaction.chargedCurrency || rawTransaction.originalCurrency,
      description: rawTransaction.description.trim(),
      memo: rawTransaction.memo || undefined,
      status: this.normalizeStatus(rawTransaction.status),
      type: rawTransaction.type === 'installments' ? 'installments' : 'normal',
      identifier: rawTransaction.identifier,
      installments: rawTransaction.installments || undefined,
    };

    // Vendor-specific mapping
    switch (vendorId) {
      case 'isracard':
        return new IsracardTransaction({
          ...baseFields,
          vendorId: 'isracard',
          cardIndex: rawTransaction.cardIndex,
          enrichmentData: {
            sector: rawTransaction.sector,
            voucherNumber: rawTransaction.voucherNumberRatz,
            isOutbound: rawTransaction.dealSumOutbound || false,
            dealSumType: rawTransaction.dealSumType,
          },
          rawJson,
        });

      case 'amex':
        return new AmexTransaction({
          ...baseFields,
          vendorId: 'amex',
          cardIndex: rawTransaction.cardIndex,
          enrichmentData: {
            sector: rawTransaction.sector,
            voucherNumber: rawTransaction.voucherNumberRatz,
            isOutbound: rawTransaction.dealSumOutbound || false,
            dealSumType: rawTransaction.dealSumType,
          },
          rawJson,
        });

      case 'max':
        return new MaxTransaction({
          ...baseFields,
          vendorId: 'max',
          cardLast4Digits: rawTransaction.shortCardNumber?.slice(-4),
          enrichmentData: {
            maxCategoryId: rawTransaction.categoryId,
            arn: rawTransaction.dealData?.arn,
            planTypeId: rawTransaction.planTypeId,
            planName: rawTransaction.planName,
          },
          rawJson,
        });

      case 'visaCal':
        return new VisaCalTransaction({
          ...baseFields,
          vendorId: 'visaCal',
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
          rawJson,
        });

      // Banks default to BankTransaction
      case 'hapoalim':
      case 'leumi':
      case 'discount':
      case 'mizrahi':
      case 'union':
      case 'massad':
      case 'yahav':
      case 'beinleumi':
      case 'otsarHahayal':
      default:
        return new BankTransaction({
          ...baseFields,
          vendorId: vendorId as any,
          rawJson,
        });
    }
  }

  private static normalizeDate(date: string | Date): Date {
    return typeof date === 'string' ? new Date(date) : date;
  }

  private static normalizeStatus(status: string): 'completed' | 'pending' {
    return status === 'pending' ? 'pending' : 'completed';
  }
}
```

---

### 3. Enhanced Categorization Service

```typescript
// service/src/services/categorization.service.ts (refactored)

import { Logger } from '../utils/logger';
import { CategoryRepository } from '../repositories/category.repository';
import { TransactionBase, CreditCardTransaction } from '../models';

export class CategorizationService {
  constructor(
    private logger: Logger,
    private categoryRepository: CategoryRepository,
  ) {}

  /**
   * Multi-strategy categorization:
   * 1. Try vendor-specific enrichment (if available)
   * 2. Fall back to description-based keyword matching
   * 3. Use Unknown category if no match found
   */
  async categorizeTransaction(transaction: TransactionBase): Promise<string[]> {
    this.logger.debug(`Categorizing transaction`, {
      description: transaction.description,
      vendor: transaction.vendorId,
      hasEnrichment: transaction instanceof CreditCardTransaction,
    });

    // Step 1: Try vendor-specific categorization
    if (transaction instanceof CreditCardTransaction) {
      const vendorCategories = await transaction.getVendorSpecificCategories();
      if (vendorCategories.length > 0) {
        this.logger.debug(`Used vendor-specific categorization`, {
          categories: vendorCategories,
          vendor: transaction.vendorId,
        });
        return vendorCategories;
      }
    }

    // Step 2: Fall back to keyword matching
    const keywordCategories = this.categorizeByKeywords(transaction.description);
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
          break;
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

### 4. Vendor-Specific Category Mapping

Create category mapping services for each vendor:

```typescript
// service/src/mappers/isracard-category.mapper.ts

const ISRACARD_SECTOR_MAPPING: Record<string, string[]> = {
  'דלק ותחבורה': ['Transportation', 'Gas & Fuel'],
  'מסעדות ובר': ['Dining & Restaurants'],
  'בריאות ותזונה': ['Health & Wellness', 'Pharmacy'],
  'קניות': ['Shopping', 'Retail'],
  'תרבות וקולנוע': ['Entertainment', 'Culture'],
  'תיירות ומלונות': ['Travel', 'Hotels'],
  'טלקום ומדיה': ['Communications', 'Utilities'],
  'גז וחשמל': ['Utilities'],
  'ביטוח': ['Insurance'],
  'בנקים ודלקים': ['Finance', 'Banking'],
  'בנקים': ['Finance', 'Banking'],
  'בנקים ודלקים': ['Finance', 'Banking'],
};

export async function mapIsracardSectorToCategories(
  sector: string,
  categoryRepository: CategoryRepository
): Promise<string[]> {
  const hebrewSector = sector.trim();
  const categoryNames = ISRACARD_SECTOR_MAPPING[hebrewSector] || [];

  const categoryIds: string[] = [];
  for (const name of categoryNames) {
    const category = categoryRepository.findByName(name);
    if (category) {
      categoryIds.push(category.id);
    }
  }

  return categoryIds;
}
```

```typescript
// service/src/mappers/max-category.mapper.ts

const MAX_CATEGORY_ID_MAPPING: Record<number, string[]> = {
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
  // ... more mappings based on Max's category system
};

export async function mapMaxCategoryIdToCategories(
  categoryId: number,
  categoryRepository: CategoryRepository
): Promise<string[]> {
  const categoryNames = MAX_CATEGORY_ID_MAPPING[categoryId] || [];

  const categoryIds: string[] = [];
  for (const name of categoryNames) {
    const category = categoryRepository.findByName(name);
    if (category) {
      categoryIds.push(category.id);
    }
  }

  return categoryIds;
}
```

---

### 5. Updated Transaction Processor Service

```typescript
// service/src/services/transaction-processor.service.ts

import { TransactionFactory } from '../factories/transaction.factory';
import { TransactionBase } from '../models';
import { Logger } from '../utils/logger';

export class TransactionProcessorService {
  constructor(private logger: Logger) {}

  /**
   * Convert raw scraped transactions to domain models
   * Each transaction is properly typed based on vendor
   */
  processTransactions(
    rawTransactions: any[],
    accountId: string,
    vendorId: string
  ): TransactionBase[] {
    this.logger.dbLog(`Processing ${rawTransactions.length} transactions`, {
      accountId,
      vendorId,
    });

    const processed: TransactionBase[] = [];
    const seenHashes = new Set<string>();

    for (const rawTxn of rawTransactions) {
      try {
        const transaction = TransactionFactory.createTransaction(
          rawTxn,
          vendorId,
          accountId,
          JSON.stringify(rawTxn)
        );

        // Hash for deduplication
        const txnHash = this.generateTransactionHash(transaction);
        if (seenHashes.has(txnHash)) {
          this.logger.debug(`Duplicate transaction detected`, {
            hash: txnHash,
            description: transaction.description,
          });
          continue;
        }

        seenHashes.add(txnHash);
        processed.push(transaction);
      } catch (error) {
        this.logger.warn(`Failed to process transaction`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          vendorId,
        });
      }
    }

    return processed;
  }

  private generateTransactionHash(transaction: TransactionBase): string {
    return crypto
      .createHash('sha256')
      .update(
        `${transaction.date.toISOString()}-${transaction.chargedAmount}-${transaction.description}`
      )
      .digest('hex');
  }
}
```

---

### 6. Updated Scraper Orchestrator Integration

```typescript
// service/src/services/scraper-orchestrator.service.ts (relevant section)

// In executeJob method, replace transaction handling:

const processedTransactions = this.transactionProcessor.processTransactions(
  result.transactions,
  account.accountId,
  account.companyId  // Pass vendor ID
);

for (const txn of processedTransactions) {
  const existingTxn = this.transactionRepository.findByHash(
    account.accountId,
    this.generateHash(txn)
  );

  if (!existingTxn) {
    // Use enhanced categorization that leverages vendor-specific enrichment
    const categoryIds = await this.categorizationService.categorizeTransaction(txn);

    // Persist transaction with enrichment data
    const savedTxn = this.transactionRepository.create({
      accountId: account.accountId,
      transaction: txn,
      categoryIds,
      enrichmentData: txn.getEnrichmentData(),
    });

    savedTransactionsCount++;
  }
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Create `TransactionBase` abstract class
- [ ] Create `BankTransaction` class
- [ ] Create vendor-specific transaction classes (IsracardTransaction, MaxTransaction, etc.)
- [ ] Create `TransactionFactory`
- [ ] Update transaction processor to use factory

### Phase 2: Categorization (Weeks 3-4)
- [ ] Implement vendor-specific category mapping services
- [ ] Update `CategorizationService` with multi-strategy approach
- [ ] Implement abstract `getVendorSpecificCategories()` in each model
- [ ] Create category mapping for Isracard sectors
- [ ] Create category mapping for Max categories

### Phase 3: Integration (Weeks 5-6)
- [ ] Update `ScraperOrchestratorService` to use new models
- [ ] Update `TransactionRepository` to store enrichment data
- [ ] Update `Transaction` database schema to include enrichment_data JSONB column
- [ ] Migrate existing transactions (optional)

### Phase 4: Testing & Optimization (Weeks 7-8)
- [ ] Unit tests for each transaction model
- [ ] Integration tests with real scraper data
- [ ] Performance profiling
- [ ] Documentation updates

---

## Database Schema Changes

### New Transaction Enrichment Column

```sql
ALTER TABLE transactions ADD COLUMN enrichment_data JSONB DEFAULT '{}';

-- Example for Isracard transaction:
-- {
--   "sector": "דלק ותחבורה",
--   "voucherNumber": "1234567",
--   "isOutbound": false,
--   "dealSumType": null
-- }

-- Example for Max transaction:
-- {
--   "maxCategoryId": 1,
--   "arn": "ABC123456789",
--   "planTypeId": 5,
--   "planName": "Normal"
-- }
```

### Example Query for Enrichment

```sql
-- Find all Isracard transactions in specific sectors
SELECT * FROM transactions 
WHERE account_id IN (
  SELECT id FROM accounts WHERE company_id = 'isracard'
)
AND enrichment_data->>'sector' = 'דלק ותחבורה'
AND date > NOW() - INTERVAL '30 days';
```

---

## Available Scraper Enrichment Data Summary

| Vendor | Additional Data Field | Type | Availability | Use Case |
|--------|----------------------|------|--------------|----------|
| **Isracard** | `sector` | String (Hebrew) | Via secondary API call | Merchant sector classification → Categories |
| **Amex** | `sector` | String (Hebrew) | Via secondary API call | Same as Isracard (shares base scraper) |
| **Max** | `categoryId` | Number | Direct scrape | Pre-categorized by Max system |
| **Max** | `arn` (ARN) | String | Direct scrape | Merchant network reference |
| **Max** | `planTypeId` | Number | Direct scrape | Transaction type classifier |
| **Visa Cal** | `merchantID` | String | Direct scrape | Merchant network lookup |
| **Visa Cal** | `merchantAddress` | String | Direct scrape | Location-based categorization |
| **Visa Cal** | `merchantPhoneNo` | String | Direct scrape | Merchant contact (future: business validation) |
| **Visa Cal** | `branchCodeDesc` | String | Direct scrape | Merchant category descriptor |
| **Visa Cal** | `trnTypeCode` | String | Direct scrape | Transaction type (regular, credit, installments) |

---

## Benefits of This Architecture

### 1. **Extensibility**
- Adding new financial sources requires only:
  - New `TransactionSubclass extends CreditCardTransaction`
  - New entry in `TransactionFactory`
  - New category mapper (optional)

### 2. **Type Safety**
- Vendor-specific fields are properly typed
- IDE autocomplete works for vendor-specific enrichment
- Compile-time checking prevents field access errors

### 3. **Backward Compatibility**
- Existing code using generic `Transaction` interface continues to work
- Database schema augmented, not breaking

### 4. **Smart Categorization**
- Multi-level fallback strategy
- Vendors with enrichment get better automatic categorization
- Users can still override categories manually

### 5. **Future-Proof**
- Can easily add more enrichment fields
- Can integrate machine learning on enrichment data
- Can add merchant database lookups in future

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Breaking existing code | Ensure `BankTransaction` maintains backward compatibility; use gradual migration |
| Isracard sector mapping gaps | Start with top 10 sectors, expand iteratively; fallback to keyword matching |
| Performance with enrichment queries | Add database indexes on `enrichment_data` JSONB columns |
| Category mapping maintenance | Create admin UI for mapping updates |

---

## References

- **Israeli Bank Scrapers**: https://github.com/eshaham/israeli-bank-scrapers (v6.3.1)
- **Isracard Transaction Details**: `base-isracard-amex.ts` - `PirteyIska_204` API endpoint
- **Max Transaction Categories**: `max.ts` - Built-in `categoryId` field mapping
- **Visa Cal Merchant Data**: `visa-cal.ts` - Direct field availability
- **Current Transaction Model**: `/service/src/types/index.ts`

---

## Conclusion

This architecture provides a robust, extensible foundation for multi-vendor transaction enrichment. It balances:
- **Pragmatism**: Leverages existing vendor data without requiring new APIs
- **Generalization**: Works for current and future financial sources
- **Maintainability**: Clear patterns for adding new vendors/enrichment
- **Performance**: Minimal overhead, leverages existing scraper calls

The phased implementation allows for gradual rollout with validation at each step.
