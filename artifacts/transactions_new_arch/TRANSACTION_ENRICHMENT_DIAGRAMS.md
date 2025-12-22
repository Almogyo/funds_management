# Transaction Enrichment Architecture - Visual Diagrams

## 1. Current State vs. Proposed Architecture

### Current Flow (Simplified)
```
Israeli Bank Scrapers
    ↓
BankTransaction (single model for all vendors)
    ↓
TransactionProcessorService
    ↓
TransactionRepository (stored)
    ↓
CategorizationService (keyword matching only)
    ↓
Categories assigned
```

### Proposed Flow (Enhanced)
```
Israeli Bank Scrapers
    ↓
TransactionFactory (vendor-aware)
    ├→ IsracardTransaction (with sector enrichment)
    ├→ MaxTransaction (with categoryId enrichment)
    ├→ VisaCalTransaction (with merchant metadata)
    ├→ AmexTransaction (with sector enrichment)
    └→ BankTransaction (no enrichment)
    ↓
TransactionProcessorService
    ↓
TransactionRepository + enrichment_data JSONB column
    ↓
CategorizationService (multi-strategy)
    ├→ Step 1: Vendor-specific categorization
    ├→ Step 2: Keyword matching (fallback)
    └→ Step 3: Unknown category (last resort)
    ↓
Categories assigned (smarter, more accurate)
```

---

## 2. Class Hierarchy Diagram

```
┌─────────────────────────────────────┐
│      TransactionBase (abstract)      │
├─────────────────────────────────────┤
│ # vendorId: string                  │
│ # sourceType: 'bank'|'credit_card'  │
│ # date: Date                        │
│ # processedDate: Date               │
│ # originalAmount: number            │
│ # originalCurrency: string          │
│ # chargedAmount: number             │
│ # chargedCurrency: string           │
│ # description: string               │
│ # memo?: string                     │
│ # status: 'completed'|'pending'     │
│ # identifier?: string               │
│ # installments?: {...}              │
├─────────────────────────────────────┤
│ + getVendorSpecificCategories()     │
│ + getEnrichmentData()               │
└────────┬────────────────────────────┘
         │
    ┌────┴─────────────────────────────────┐
    │                                       │
    ▼                                       ▼
┌──────────────┐            ┌──────────────────────────┐
│BankTransaction│          │CreditCardTransaction      │
│              │          │(abstract)                 │
├──────────────┤          ├──────────────────────────┤
│vendorId:     │          │cardLast4Digits?: string  │
│'hapoalim'|..│          │cardIndex?: number        │
│              │          │enrichmentData: {...}    │
│checkNumber?  │          └────────┬─────────────────┘
│transCode?    │                  │
└──────────────┘     ┌────────────┼────────────┬──────────────┐
                     │            │            │              │
                     ▼            ▼            ▼              ▼
            ┌──────────────┐  ┌────────┐  ┌────┐      ┌──────────────┐
            │IsracardTxn   │  │MaxTxn  │  │Amex│      │VisaCalTxn   │
            ├──────────────┤  ├────────┤  └────┘      ├──────────────┤
            │enrichment:   │  │max     │              │enrichment:   │
            │ sector       │  │Category│              │ merchant     │
            │ voucher#     │  │ arn    │              │ metadata     │
            │ isOutbound   │  │ plan   │              │ trnTypeCode  │
            │              │  │ type   │              │              │
            └──────────────┘  └────────┘              └──────────────┘
```

---

## 3. Factory Pattern Flow

```
Raw Scraper Data
    ↓
TransactionFactory.createTransaction(
  rawData,
  vendorId,
  accountId,
  rawJson
)
    ↓
[Switch on vendorId]
    │
    ├─ 'isracard' → New IsracardTransaction({...})
    │   └─ Extracts: sector, voucherNumber, isOutbound
    │
    ├─ 'amex' → New AmexTransaction({...})
    │   └─ Extracts: sector, voucherNumber, isOutbound
    │
    ├─ 'max' → New MaxTransaction({...})
    │   └─ Extracts: maxCategoryId, arn, planTypeId
    │
    ├─ 'visaCal' → New VisaCalTransaction({...})
    │   └─ Extracts: merchantMetadata, trnTypeCode
    │
    └─ [others] → New BankTransaction({...})
        └─ Basic fields only
    ↓
Properly typed TransactionBase subclass
```

---

## 4. Multi-Strategy Categorization Flow

```
Transaction arrives at CategorizationService
    ↓
┌───────────────────────────────────────────────┐
│ STRATEGY 1: Vendor-Specific Categorization   │
├───────────────────────────────────────────────┤
│ Is this a CreditCardTransaction?              │
│   ├─ YES: Call getVendorSpecificCategories()  │
│   │   ├─ Isracard: Map sector → categories    │
│   │   ├─ Max: Map categoryId → categories     │
│   │   ├─ VisaCal: Map merchant → categories   │
│   │   │                                       │
│   │   └─ Categories found? → Return & Done!   │
│   │                                           │
│   └─ NO: Continue to Strategy 2               │
│                                               │
└───────────────────────────────────────────────┘
    ↓ (if no vendor categories found)
┌───────────────────────────────────────────────┐
│ STRATEGY 2: Keyword-Based Categorization     │
├───────────────────────────────────────────────┤
│ Extract keywords from description             │
│   ├─ Search in category keywords              │
│   │   ├─ "דלק" → Fuel category                │
│   │   ├─ "מסעדה" → Dining category           │
│   │   └─ "בית חולים" → Healthcare            │
│   │                                           │
│   └─ Categories found? → Return & Done!       │
│                                               │
└───────────────────────────────────────────────┘
    ↓ (if no keywords matched)
┌───────────────────────────────────────────────┐
│ STRATEGY 3: Default Unknown Category          │
├───────────────────────────────────────────────┤
│ Return 'Unknown' category ID                  │
│ Log for later manual review                   │
│                                               │
└───────────────────────────────────────────────┘
    ↓
Final categories array returned to caller
```

---

## 5. Data Flow: Isracard Transaction with Enrichment

```
Step 1: SCRAPE
┌─────────────────────────────────┐
│ Isracard API (Standard Request) │
├─────────────────────────────────┤
│ Returns transactions with:      │
│ - fullSupplierNameHeb: "דלק"   │
│ - dealSum: 150                  │
│ - voucherNumberRatz: "1234567"  │
│                                 │
│ NOTE: NO sector yet             │
└─────────────────────────────────┘
    ↓
Step 2: ENRICH
┌──────────────────────────────────────┐
│ Isracard API (Detail Request)        │
│ reqName=PirteyIska_204               │
│ shovarRatz=1234567                   │
├──────────────────────────────────────┤
│ Returns:                             │
│ - sector: "דלק ותחבורה"             │
│ - other merchant details            │
└──────────────────────────────────────┘
    ↓
Step 3: TRANSFORM
┌──────────────────────────────────────┐
│ TransactionFactory creates:          │
│ IsracardTransaction {               │
│   date: "2025-12-15"               │
│   description: "דלק"                │
│   amount: 150                      │
│   identifier: "1234567"            │
│   enrichmentData: {                │
│     sector: "דלק ותחבורה",         │
│     voucherNumber: "1234567",      │
│     dealSumType: null,             │
│     isOutbound: false              │
│   }                                │
│ }                                  │
└──────────────────────────────────────┘
    ↓
Step 4: CATEGORIZE
┌──────────────────────────────────────┐
│ CategorizationService:               │
│ Call getVendorSpecificCategories()  │
│   sector = "דלק ותחבורה"            │
│   ↓                                  │
│   ISRACARD_SECTOR_MAPPING lookup    │
│   ↓                                  │
│   categoryNames = ["Fuel", "Trans"]  │
│   ↓                                  │
│   Lookup "Fuel" → categoryId_X      │
│   Lookup "Trans" → categoryId_Y      │
│   ↓                                  │
│   Return [categoryId_X, categoryId_Y]│
└──────────────────────────────────────┘
    ↓
Step 5: PERSIST
┌──────────────────────────────────────┐
│ TransactionRepository.create()      │
│                                      │
│ INSERT INTO transactions (         │
│   date, description, amount,       │
│   enrichment_data                  │
│ ) VALUES (                         │
│   "2025-12-15",                    │
│   "דלק",                            │
│   150,                             │
│   {                                │
│     "sector": "דלק ותחבורה",       │
│     "voucherNumber": "1234567",    │
│     "isOutbound": false            │
│   }                                │
│ )                                  │
│                                      │
│ INSERT INTO transaction_categories │
│   (transaction_id, category_id)    │
│ VALUES (txn_1, cat_fuel),          │
│        (txn_1, cat_transport)      │
│                                      │
└──────────────────────────────────────┘
    ↓
DONE: Transaction stored with smart categorization!
```

---

## 6. Database Schema Evolution

### Before
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  account_id UUID,
  txn_hash VARCHAR,
  date TIMESTAMP,
  processed_date TIMESTAMP,
  amount DECIMAL,
  currency VARCHAR,
  description TEXT,
  category_id UUID,  -- Single category
  status VARCHAR,
  installment_number INT,
  installment_total INT,
  raw_json TEXT,
  created_at TIMESTAMP
);

-- Issue: No vendor-specific enrichment stored
-- Solution: Add enrichment_data column
```

### After
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  account_id UUID,
  txn_hash VARCHAR,
  date TIMESTAMP,
  processed_date TIMESTAMP,
  amount DECIMAL,
  currency VARCHAR,
  description TEXT,
  -- Note: category now in transaction_categories junction table
  status VARCHAR,
  installment_number INT,
  installment_total INT,
  raw_json TEXT,
  enrichment_data JSONB DEFAULT '{}',  -- ← NEW!
  created_at TIMESTAMP
);

-- Index for efficient enrichment queries
CREATE INDEX idx_enrichment_sector 
ON transactions USING GIN (enrichment_data jsonb_ops)
WHERE enrichment_data->>'sector' IS NOT NULL;

CREATE INDEX idx_enrichment_max_cat 
ON transactions USING GIN (enrichment_data jsonb_ops)
WHERE enrichment_data->>'maxCategoryId' IS NOT NULL;
```

### Example Records

```sql
-- Isracard transaction
SELECT id, description, enrichment_data FROM transactions 
WHERE enrichment_data->>'sector' = 'דלק ותחבורה'
LIMIT 1;

-- Result:
-- id: 550e8400-e29b-41d4-a716-446655440000
-- description: דלק
-- enrichment_data: {
--   "sector": "דלק ותחבורה",
--   "voucherNumber": "1234567",
--   "isOutbound": false,
--   "dealSumType": null
-- }

-- Max transaction
SELECT id, description, enrichment_data FROM transactions 
WHERE enrichment_data->>'maxCategoryId' IS NOT NULL
LIMIT 1;

-- Result:
-- id: 660e8400-e29b-41d4-a716-446655440000
-- description: שופרסל
-- enrichment_data: {
--   "maxCategoryId": 1,
--   "arn": "ABC123456789",
--   "planTypeId": 5,
--   "planName": "Normal"
-- }
```

---

## 7. Vendor Coverage Matrix

```
┌─────────────┬──────────────────┬─────────────┬────────────────┐
│ Vendor      │ Enrichment Type  │ Effort (1-5)│ Benefit (1-5)  │
├─────────────┼──────────────────┼─────────────┼────────────────┤
│ Isracard    │ Sector (API call)│ ★★☆☆☆ (2)  │ ★★★★☆ (4)    │
│ Amex        │ Sector (API call)│ ★★☆☆☆ (2)  │ ★★★★☆ (4)    │
│ Max         │ Category ID      │ ★☆☆☆☆ (1)  │ ★★★★★ (5)    │
│ Visa Cal    │ Merchant Data    │ ★★☆☆☆ (2)  │ ★★★★☆ (4)    │
├─────────────┼──────────────────┼─────────────┼────────────────┤
│ Hapoalim    │ None available   │ ★☆☆☆☆ (1)  │ ★★☆☆☆ (2)    │
│ Leumi       │ None available   │ ★☆☆☆☆ (1)  │ ★★☆☆☆ (2)    │
│ Others      │ Minimal          │ ★★☆☆☆ (2)  │ ★★☆☆☆ (2)    │
└─────────────┴──────────────────┴─────────────┴────────────────┘

Legend:
- Effort: Implementation complexity
- Benefit: Categorization quality improvement
```

---

## 8. Implementation Timeline (Visual Gantt)

```
Phase 1: Foundation (2 weeks)
├─ Week 1
│  ├─ Mon-Wed: TransactionBase + models
│  ├─ Thu-Fri: BankTransaction variant
│  └─
└─ Week 2
   ├─ Mon-Tue: Vendor-specific models
   ├─ Wed-Thu: TransactionFactory
   └─ Fri: TransactionProcessor integration

Phase 2: Categorization (2 weeks)
├─ Week 3
│  ├─ Mon-Wed: Category mappers (Isracard, Max, VisaCal)
│  ├─ Thu-Fri: Test mappers
│  └─
└─ Week 4
   ├─ Mon-Tue: CategorizationService refactor
   ├─ Wed-Thu: Integration tests
   └─ Fri: Code review

Phase 3: Integration (2 weeks)
├─ Week 5
│  ├─ Mon-Tue: Database migration
│  ├─ Wed: TransactionRepository updates
│  ├─ Thu: ScraperOrchestratorService refactor
│  └─ Fri: Integration testing
└─ Week 6
   ├─ Mon-Tue: End-to-end testing
   ├─ Wed: Performance optimization
   ├─ Thu: Staging deployment
   └─ Fri: Production rollout

Phase 4: Testing & Polish (2 weeks)
├─ Week 7
│  ├─ Mon-Fri: Unit & integration tests
│  └─
└─ Week 8
   ├─ Mon-Thu: Documentation
   └─ Fri: Team training & handoff
```

---

## 9. Code Snippet: Quick Reference

### Creating a Transaction
```typescript
// Old way (still works for backward compatibility)
const txn = new BankTransaction({...});

// New way (vendor-specific)
const txn = TransactionFactory.createTransaction(
  rawScrapedData,
  'isracard',
  accountId,
  jsonString
);
```

### Using Enrichment Data
```typescript
if (txn instanceof IsracardTransaction) {
  const sector = txn.enrichmentData.sector;
  // Use sector for smarter categorization
}

if (txn instanceof MaxTransaction) {
  const categoryId = txn.enrichmentData.maxCategoryId;
  // Direct category mapping
}
```

### Categorizing with Enrichment
```typescript
const categories = await categorizationService
  .categorizeTransaction(txn);
// Automatically picks best strategy based on txn type!
```

### Querying Enrichment Data
```sql
-- Find all fuel transactions (Isracard)
SELECT * FROM transactions 
WHERE enrichment_data->>'sector' LIKE '%דלק%';

-- Find Max transactions in specific category
SELECT * FROM transactions 
WHERE enrichment_data->>'maxCategoryId' = '1';
```

---

## Summary

This architecture delivers:
1. ✅ **Type-safe** vendor-specific models
2. ✅ **Smart categorization** leveraging enrichment data
3. ✅ **Extensible** factory pattern for new vendors
4. ✅ **Backward compatible** with existing code
5. ✅ **Well-documented** with clear patterns

The implementation follows SOLID principles and leverages existing scraper data without requiring new API calls (except Isracard's already-supported secondary requests).
