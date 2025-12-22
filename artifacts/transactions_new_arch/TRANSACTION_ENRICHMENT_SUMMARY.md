# Transaction Enrichment Analysis - Executive Summary

## Overview
This document summarizes the architectural plan for enhancing the funds_management system to support vendor-specific transaction enrichment.

## Current Situation

**What's Available Now:**
- Single `BankTransaction` model for all financial sources
- Text-based categorization (keyword matching on description only)
- No vendor-specific enrichment data captured
- Basic fields: date, amount, description, memo, installments

**What's Being Scraped But Not Used:**
- Isracard: Merchant sector classification (Hebrew categories like "דלק ותחבורה")
- Max: Pre-categorized transaction types with ARN reference numbers
- Visa Cal: Full merchant metadata (ID, address, phone, category)
- Amex: Sector data (inherited from Isracard)

## Proposed Solution

### Hierarchical Transaction Model

```
TransactionBase (abstract)
├── BankTransaction (for banks like Hapoalim, Leumi)
└── CreditCardTransaction (abstract)
    ├── IsracardTransaction (with sector enrichment)
    ├── AmexTransaction (with sector enrichment)
    ├── MaxTransaction (with category ID & ARN enrichment)
    └── VisaCalTransaction (with merchant metadata enrichment)
```

### Key Architectural Patterns

1. **Inheritance**: Vendor-specific models extend base classes
2. **Factory Pattern**: Automatically creates correct transaction type based on vendor
3. **Abstract Methods**: Each vendor implements `getVendorSpecificCategories()` method
4. **Enrichment Data Serialization**: All enrichment data stored in database as JSON

### Categorization Strategy (Multi-Tier)

```
1. Try Vendor-Specific Categorization
   ├─ Isracard: Map Hebrew sector to categories
   ├─ Max: Map category ID to categories
   └─ Visa Cal: Map merchant metadata to categories
   
2. Fall Back to Keyword Matching
   └─ Existing description-based logic
   
3. Use "Unknown" Category
   └─ If no match found
```

## Vendor-Specific Enrichment Breakdown

### Isracard (COMPANY_CODE: "11")

**Direct Fields:**
- `voucherNumberRatz`: Transaction ID
- `fullSupplierNameHeb`: Description
- `dealSumOutbound`: Forex indicator

**Enriched via Secondary API Call:**
- **Sector**: Hebrew category like "דלק ותחבורה" (transportation & fuel)
- **How Obtained**: Separate `PirteyIska_204` API request per transaction
- **Mapping**: Map to internal categories (Fuel, Dining, Healthcare, etc.)

### Max (Leumi Card)

**Direct Fields:**
- `merchantName`: Description
- `categoryId`: Pre-categorized! (1-10+)
- `planTypeId`: Transaction type (2, 3, 5 = installments/normal)
- `dealData.arn`: Acquirer Reference Number

**Unique Advantage:** No secondary API calls needed; category provided directly

### Visa Cal

**Direct Fields:**
- `merchantName`: Description
- `merchantID`: Merchant network ID
- `merchantAddress`: Physical location
- `merchantPhoneNo`: Contact info
- `branchCodeDesc`: Merchant category descriptor
- `trnTypeCode`: Transaction classifier (5=regular, 6=credit, 8=installments)

**Unique Advantage:** Rich merchant context for sophisticated lookup logic

### Amex

**Direct Fields:**
- Same as Isracard (shared base scraper)
- `sector`: Hebrew category

**Characteristic:** Inherits Isracard enrichment pattern

## Database Schema Changes

**New Column:**
```sql
ALTER TABLE transactions ADD COLUMN enrichment_data JSONB DEFAULT '{}';
```

**Example Records:**

```javascript
// Isracard transaction
{
  "sector": "דלק ותחבורה",
  "voucherNumber": "1234567",
  "isOutbound": false
}

// Max transaction
{
  "maxCategoryId": 1,
  "arn": "ABC123456789",
  "planTypeId": 5,
  "planName": "Normal"
}

// Visa Cal transaction
{
  "merchantMetadata": {
    "merchantId": "M123456",
    "address": "רחוב דיזנגוף 99, תל אביב",
    "phoneNumber": "0509999999",
    "branchCode": "RETAIL_CLOTHING"
  },
  "trnTypeCode": "5"
}
```

## Implementation Phases

### Phase 1: Foundation (2 weeks)
- Create `TransactionBase` abstract class
- Create vendor-specific transaction classes
- Create `TransactionFactory`
- Update `TransactionProcessorService`

### Phase 2: Categorization (2 weeks)
- Implement category mapping services
- Update `CategorizationService` with multi-strategy
- Map Isracard sectors to categories
- Map Max category IDs to categories

### Phase 3: Integration (2 weeks)
- Update `ScraperOrchestratorService`
- Add enrichment_data column to database
- Update `TransactionRepository`
- Test with real vendor data

### Phase 4: Testing & Polish (2 weeks)
- Unit tests for all models
- Integration tests
- Performance testing
- Documentation

## Code Examples (Sneak Peek)

### Transaction Model
```typescript
export abstract class TransactionBase {
  // Common fields
  date: Date;
  description: string;
  amount: number;
  
  // Vendor info
  abstract vendorId: string;
  abstract sourceType: 'bank' | 'credit_card';
  
  // Key method - each vendor implements
  abstract getVendorSpecificCategories(): Promise<string[]>;
  
  // Enrichment serialization
  abstract getEnrichmentData(): Record<string, any>;
}
```

### Factory Usage
```typescript
const transaction = TransactionFactory.createTransaction(
  rawScrapedData,     // From israeli-bank-scrapers
  'isracard',         // Vendor ID
  accountId,
  JSON.stringify(rawScrapedData)
);

// Now transaction is IsracardTransaction with all enrichment fields typed!
```

### Categorization
```typescript
// Automatically picks the best strategy:
const categories = await categorizationService.categorizeTransaction(transaction);

// For Isracard: uses sector → categories mapping
// For Max: uses categoryId → categories mapping
// For others: falls back to keyword matching
```

## Benefits Realized

✅ **Vendor-Specific Categorization**: Better automatic categorization without user intervention  
✅ **Type Safety**: IDE knows all vendor-specific fields  
✅ **Extensibility**: Add new vendors in minutes  
✅ **Backward Compatible**: Existing code continues to work  
✅ **Future-Proof**: Easy to add AI/ML layer on enrichment data  
✅ **Well-Structured**: Clear separation of concerns  

## What's NOT Changed (Backward Compatibility)

- Database Transaction interface shape (just adds optional enrichment_data column)
- API responses (enrichment stored internally)
- User-facing categorization workflow
- Existing scraper integrations

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Isracard sector mapping gaps | Start with top sectors, expand iteratively |
| Performance impact | Minimal - reuses existing scraper calls |
| Migration of existing data | Optional; new data captured with enrichment |
| Maintaining category mappings | Create admin UI for future updates |

## Next Steps

1. **Review this plan** with team
2. **Start Phase 1** implementation
3. **Create TypeScript models** from provided templates
4. **Update test suite** with new model variations
5. **Validate with real data** from each vendor

---

## Detailed Architecture Document

See: `TRANSACTION_ENRICHMENT_ARCHITECTURE.md` for complete technical specifications, code examples, and implementation details.
