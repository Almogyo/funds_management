# Transaction Enrichment & Categorization - Performance & UX Analysis

**Date**: December 22, 2025  
**Status**: Design Phase - Ready for Implementation

---

## Part 1: Transaction Enrichment Execution Strategy

### Current Situation

**Enrichment Source Analysis:**

| Vendor | Enrichment Method | Overhead | Rate Limit Risk | Current Implementation |
|--------|-------------------|----------|-----------------|----------------------|
| **Isracard** | Secondary API call per transaction | ⚠️ HIGH | ⚠️ HIGH | Already implemented in scraper |
| **Amex** | Secondary API call per transaction | ⚠️ HIGH | ⚠️ HIGH | Already implemented in scraper |
| **Max** | Direct field in scrape response | ✅ NONE | ✅ NO | Already included |
| **Visa Cal** | Direct field in scrape response | ✅ NONE | ✅ NO | Already included |

### The Problem with Current Isracard/Amex Implementation

**Code from `base-isracard-amex.ts`:**

```typescript
async function getAdditionalTransactionInformation(
  scraperOptions: ScraperOptions,
  accountsWithIndex: ScrapedAccountsWithIndex[],
  page: Page,
  options: CompanyServiceOptions,
  allMonths: moment.Moment[],
): Promise<ScrapedAccountsWithIndex[]> {
  if (
    !scraperOptions.additionalTransactionInformation ||
    scraperOptions.optInFeatures?.includes('isracard-amex:skipAdditionalTransactionInformation')
  ) {
    return accountsWithIndex;
  }
  // Makes secondary API call for EVERY transaction in batch
  return runSerial(accountsWithIndex.map((a, i) => () => getExtraScrapAccount(page, options, a, allMonths[i])));
}

async function getExtraScrapAccount(page: Page, ...): Promise<ScrapedAccountsWithIndex> {
  for (const txn of txnGroups) {
    const updatedTxns = await Promise.all(
      // Batches in groups of 10 with 1 second sleep between batches
      txnsChunk.map(t => getExtraScrapTransaction(page, options, month, account.index, t)),
    );
    await sleep(RATE_LIMIT.SLEEP_BETWEEN);
  }
}
```

**Execution Profile:**
- **50 transactions**: ~5 seconds (50 API calls, batched in groups of 10)
- **500 transactions**: ~50 seconds (500 API calls)
- **1000 transactions**: ~100 seconds (1000 API calls)

### Risk Analysis

**Rate Limiting:**
- Isracard doesn't officially document rate limits
- Current implementation batches in groups of 10 with 1-second sleep
- Risk: 💛 MEDIUM (likely safe but untested at scale)
- Evidence: Library has been in production for 3+ years without reported rate limit issues

**Performance Impact:**
- Enrichment adds 5-100 seconds per scrape cycle
- For 500 daily transactions: 500+ seconds overhead
- **Solution: Make enrichment optional/async**

### Proposed Execution Strategy

#### Option A: Dual-Stage Scraping (RECOMMENDED)

```
Stage 1 (Mandatory - immediate):
├─ Isracard/Amex: Basic transactions only (no secondary call)
├─ Max: Full enrichment (already included)
└─ Visa Cal: Full enrichment (already included)
  ↓
[Store transactions immediately]
  ↓
Stage 2 (Async background job - optional):
└─ Isracard/Amex enrichment via background worker
  ├─ Batch missing enrichments every hour
  ├─ Rate-limited to safe levels
  └─ Retry failed enrichments
```

**Benefits:**
- ✅ Fast initial transaction load (5-10 seconds)
- ✅ User sees transactions immediately
- ✅ Enrichment happens asynchronously
- ✅ Rate limiting handled safely
- ✅ Natural fallback to fuzzy matching for missing enrichments

#### Option B: Smart Lazy Loading

```
When categorizing transaction:
├─ Check if enrichment exists
├─ If missing AND score_without_enrichment < threshold:
│   └─ Fetch enrichment on-demand
└─ Otherwise: Use available data
```

**Risks:**
- Adds latency to categorization requests
- Difficult rate limit control
- Not recommended

#### Option C: Bulk Parallel Batching

```
For transactions without enrichment:
├─ Collect all missing enrichment IDs
├─ Fetch in parallel batches of 10
├─ Rate limit: 1 second between batches
└─ Store results
```

**When to use:**
- Migration of existing transactions
- Manual bulk enrichment updates

### Recommended Implementation: Dual-Stage + Background Job

```typescript
// Phase 1: During scrape (fast)
const transactions = await scraper.scrape(credentials);
// Includes basic fields + Max/VisaCal enrichment
// Israelcard/Amex: NO secondary calls

// Phase 2: Background job (after scrape completes)
const missingEnrichments = await findTransactionsNeedingEnrichment(
  'isracard',
  'amex'
);

if (missingEnrichments.length > 0) {
  // Queue background job
  await backgroundQueue.enqueue({
    type: 'enrich_transactions',
    transactions: missingEnrichments,
    batchSize: 10,
    rateLimitMs: 1000,
  });
}

// Result: Transaction with enrichment_data: { sector: "..." }
// If enrichment fails: enrichment_data: {} (categorization uses fuzzy matching)
```

**Expected Performance:**
- Initial scrape: 5-10 seconds (no enrichment)
- Enrichment background job: Runs async, doesn't block
- Categorization: 50-200ms (immediate, with or without enrichment)

### Rate Limiting Strategy

```
Conservative approach (proven safe):
├─ Batch size: 10 transactions
├─ Sleep between batches: 1000ms (1 second)
├─ Max concurrent requests: 1
├─ Retry policy: Exponential backoff (1s, 2s, 4s, 8s)
├─ Circuit breaker: Stop if 3 consecutive failures

Throttle metrics to monitor:
├─ HTTP 429 responses (rate limit hit)
├─ HTTP 500+ responses (server errors)
├─ Response time > 5 seconds
└─ Error rate > 5%
```

### Can We Load All Enrichment Upfront?

**Analysis:**

For 500 daily Isracard transactions:
- **Duration**: ~50 seconds
- **Upfront**: When scraping runs
- **Alternative**: Spread over 24 hours = 2-3 seconds/hour (negligible)

**Verdict**: YES, but:
- Should be **optional** (user configurable)
- Should be **retryable** (if fails, continue without)
- Should **not block** initial transaction load

---

## Part 2: User-Powered Categorization with Fuzzy Matching

### Current Problem

- System assumes vendor categorization is "correct"
- No user override capability
- Single-category enforcement
- No transparency on categorization confidence

### Proposed Solution

#### Data Model Changes

```typescript
interface TransactionCategory {
  categoryId: string;
  categoryName: string;
  isManual: boolean;           // true = user selected, false = system
  isMain: boolean;              // true = primary category (for analytics)
  createdAt: Date;
  source: 'description' | 'vendor' | 'user'; // NEW: track origin
}

interface TransactionCategoryScore {
  categoryId: string;
  categoryName: string;
  
  // Fuzzy matching scores
  description_category_fuzzy_score: number; // 0-100, ratio of description
  vendor_category_fuzzy_score?: number;     // 0-100, ratio of vendor category
  
  // Metadata
  source: 'description' | 'vendor';
  confidence: 'high' | 'medium' | 'low';    // Based on score
}
```

#### Decision Hierarchy Logic

```
Input:
├─ description_categories: [{categoryId, score}, ...]
├─ vendor_category: {categoryId, score} or null
└─ thresholds: { description: 75, vendor: 60 }

Decision Tree:
│
├─ [IF vendor_category exists AND vendor_score >= threshold]
│   │
│   ├─ [IF description_score >= threshold AND description_score > vendor_score * 1.1]
│   │   └─ CHOOSE: description_category (with reason: "Better description match")
│   │
│   └─ [ELSE]
│       └─ CHOOSE: vendor_category (with reason: "Vendor categorization")
│
└─ [ELSE vendor_category missing or below threshold]
    │
    ├─ [IF description_score >= threshold]
    │   └─ CHOOSE: description_category
    │
    └─ [ELSE]
        └─ CHOOSE: Unknown (no reliable match)

Result:
├─ mainCategory: CategoryId
├─ categories: [all matched CategoryIds]
├─ scores: {...}
├─ confidence: 'high' | 'medium' | 'low'
├─ reason: "Description match exceeded vendor category"
└─ source: 'description' | 'vendor' | 'user'
```

#### Fuzzy Matching Implementation

```typescript
import { fuzzwuzzy } from 'fuzzwuzzy'; // Library to use

interface FuzzyMatchResult {
  categoryId: string;
  categoryName: string;
  
  // Fuzzy matching metrics
  ratio: number;              // 0-100: simple string similarity
  partial_ratio: number;      // 0-100: best matching substring
  token_sort_ratio: number;   // 0-100: after sorting tokens
  token_set_ratio: number;    // 0-100: set intersection based
  
  // Combined score (weighted average)
  combined_score: number;     // (ratio * 0.2 + partial_ratio * 0.3 + token_set_ratio * 0.5)
  
  // Final score used for decisions
  final_score: number;        // combined_score if >= 50, else 0
}

// For DESCRIPTION vs CATEGORIES:
Example: transaction.description = "דלק מחלקה 5"
         categories = ["Fuel", "Transportation", "Dining"]
         
Results:
  "Fuel": { ratio: 85, partial_ratio: 90, token_set_ratio: 88, final: 88 }
  "Transportation": { ratio: 42, partial_ratio: 45, token_set_ratio: 40, final: 0 }
  "Dining": { ratio: 15, partial_ratio: 18, token_set_ratio: 12, final: 0 }

// For VENDOR CATEGORY vs OUR CATEGORIES:
Example: vendor_category = "דלק ותחבורה" (Hebrew sector from Isracard)
         our_categories = ["Fuel", "Transportation", "Dining"]
         
Step 1: Translate/normalize vendor category name
Step 2: Fuzzy match against our category names
        
Results:
  "Fuel": { ratio: 92, partial_ratio: 95, token_set_ratio: 94, final: 94 }
  "Transportation": { ratio: 88, partial_ratio: 91, token_set_ratio: 89, final: 89 }
  "Dining": { ratio: 10, partial_ratio: 12, token_set_ratio: 8, final: 0 }
```

### User Override Flow

```
Current State:
├─ Transaction categorized as: "Fuel" (vendor-based, score: 85)
└─ User sees: Single category, hard to override

New Flow:
├─ Display: All candidate categories with scores
│   ├─ Fuel (85, vendor source)
│   ├─ Transportation (75, description source)
│   └─ Other (42, low confidence)
│
├─ User can: Click to set any as main category
│   └─ POST /api/transactions/{id}/category
│       ├─ mainCategoryId: "..."
│       └─ Triggers: Update isMain=true, source='user', isManual=true
│
└─ Result: Transaction now shows user-selected category
    └─ System learns: Store override for training data
```

#### Database Schema Updates

```sql
-- Add scoring columns
ALTER TABLE transaction_categories ADD COLUMN source VARCHAR DEFAULT 'system';
-- source: 'description' | 'vendor' | 'user'

-- Add scoring audit table for analysis
CREATE TABLE category_scores (
  id UUID PRIMARY KEY,
  transaction_id UUID,
  categoryId UUID,
  categoryName VARCHAR,
  description_fuzzy_score FLOAT,
  vendor_fuzzy_score FLOAT,
  calculated_at TIMESTAMP,
  user_override_at TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

-- Query to see override patterns:
SELECT 
  categoryId,
  COUNT(*) as override_count,
  AVG(description_fuzzy_score) as avg_desc_score,
  AVG(vendor_fuzzy_score) as avg_vendor_score
FROM category_scores
WHERE user_override_at IS NOT NULL
GROUP BY categoryId
ORDER BY override_count DESC;
```

---

## Part 3: New Categorization Service Architecture

### Service Layers

```
Controller (API)
    ↓
CategorizationService (orchestration)
    ├─ FuzzyMatchingService (score calculation)
    │   ├─ DescriptionMatcher (description vs categories)
    │   └─ VendorCategoryMatcher (vendor category vs categories)
    │
    ├─ DecisionEngine (hierarchy logic)
    │   ├─ Apply thresholds
    │   ├─ Apply hierarchy rules
    │   └─ Determine main_category
    │
    └─ Repository (persistence)
        └─ Store scores & decisions
```

### FuzzyMatchingService

```typescript
export class FuzzyMatchingService {
  /**
   * Score description against all categories
   * Returns sorted by score descending
   */
  async scoreDescriptionAgainstCategories(
    description: string,
    categories: Category[]
  ): Promise<DescriptionMatchResult[]> {
    const results: DescriptionMatchResult[] = [];
    
    for (const category of categories) {
      // Include category name and keywords
      const categoryTexts = [
        category.name,
        ...category.keywords,
      ].filter(Boolean);
      
      const scores = categoryTexts.map(text => ({
        ratio: fuzzywuzzy.ratio(description, text),
        partial_ratio: fuzzywuzzy.partialRatio(description, text),
        token_set_ratio: fuzzywuzzy.tokenSetRatio(description, text),
      }));
      
      // Use best match
      const best = scores.reduce((a, b) => 
        (a.ratio + a.partial_ratio + a.token_set_ratio) > 
        (b.ratio + b.partial_ratio + b.token_set_ratio) ? a : b
      );
      
      const combined_score = 
        best.ratio * 0.2 + 
        best.partial_ratio * 0.3 + 
        best.token_set_ratio * 0.5;
      
      results.push({
        categoryId: category.id,
        categoryName: category.name,
        ratio: best.ratio,
        partial_ratio: best.partial_ratio,
        token_set_ratio: best.token_set_ratio,
        combined_score,
        final_score: combined_score >= 50 ? combined_score : 0,
        source: 'description',
      });
    }
    
    return results.sort((a, b) => b.final_score - a.final_score);
  }

  /**
   * Score vendor category against our categories
   * Requires vendor category to be mapped/normalized
   */
  async scoreVendorCategoryAgainstCategories(
    vendorCategoryName: string,
    categories: Category[]
  ): Promise<VendorMatchResult> {
    // Normalize vendor category name (e.g., translate Hebrew)
    const normalized = await this.normalizeVendorCategory(vendorCategoryName);
    
    let bestMatch: VendorMatchResult | null = null;
    let bestScore = 0;
    
    for (const category of categories) {
      const score = Math.max(
        fuzzywuzzy.ratio(normalized, category.name),
        Math.max(...category.keywords.map(kw => 
          fuzzywuzzy.partialRatio(normalized, kw)
        ))
      );
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          categoryId: category.id,
          categoryName: category.name,
          final_score: score,
          source: 'vendor',
        };
      }
    }
    
    return bestMatch || {
      categoryId: null,
      categoryName: null,
      final_score: 0,
      source: 'vendor',
    };
  }
}
```

### DecisionEngine

```typescript
export class CategorizeDecisionEngine {
  async determineMainCategory(
    descriptionMatches: DescriptionMatchResult[],
    vendorMatch: VendorMatchResult | null,
    thresholds: { description: number; vendor: number }
  ): Promise<CategorizationDecision> {
    
    const topDescriptionMatch = descriptionMatches[0];
    
    // No vendors category available
    if (!vendorMatch || vendorMatch.final_score < thresholds.vendor) {
      
      // Description match is above threshold
      if (topDescriptionMatch?.final_score >= thresholds.description) {
        return {
          mainCategoryId: topDescriptionMatch.categoryId,
          candidates: descriptionMatches,
          reason: 'Description fuzzy match above threshold',
          confidence: this.getConfidence(topDescriptionMatch.final_score),
          source: 'description',
        };
      }
      
      // No match at all
      return {
        mainCategoryId: 'unknown',
        candidates: [],
        reason: 'No category matched threshold',
        confidence: 'low',
        source: 'unknown',
      };
    }
    
    // Vendor category available AND above threshold
    // Check if description is significantly better (>10% higher)
    if (
      topDescriptionMatch?.final_score >= thresholds.description &&
      topDescriptionMatch.final_score > vendorMatch.final_score * 1.1
    ) {
      // Description wins
      return {
        mainCategoryId: topDescriptionMatch.categoryId,
        candidates: descriptionMatches,
        reason: `Description match (${topDescriptionMatch.final_score}%) exceeded vendor (${vendorMatch.final_score}%)`,
        confidence: this.getConfidence(topDescriptionMatch.final_score),
        source: 'description',
        vendorAlternative: vendorMatch,
      };
    }
    
    // Vendor wins
    return {
      mainCategoryId: vendorMatch.categoryId,
      candidates: [vendorMatch],
      reason: `Vendor categorization selected`,
      confidence: this.getConfidence(vendorMatch.final_score),
      source: 'vendor',
      descriptionAlternatives: descriptionMatches,
    };
  }
  
  private getConfidence(score: number): 'high' | 'medium' | 'low' {
    if (score >= 85) return 'high';
    if (score >= 70) return 'medium';
    return 'low';
  }
}
```

### CategorizationService (Refactored)

```typescript
export class CategorizationService {
  constructor(
    private fuzzyService: FuzzyMatchingService,
    private decisionEngine: CategorizeDecisionEngine,
    private categoryRepository: CategoryRepository,
    private categoryScoreRepository: CategoryScoreRepository,
    private logger: Logger,
    private config: {
      descriptionThreshold: number;  // default: 75
      vendorThreshold: number;        // default: 60
    }
  ) {}

  /**
   * Comprehensive categorization with fuzzy matching and vendor enrichment
   */
  async categorizeTransaction(
    transaction: TransactionBase
  ): Promise<CategorizationResult> {
    const categories = this.categoryRepository.list();
    
    // Step 1: Fuzzy match description
    const descriptionMatches = await this.fuzzyService
      .scoreDescriptionAgainstCategories(
        transaction.description,
        categories
      );
    
    // Step 2: Fuzzy match vendor category (if available)
    let vendorMatch: VendorMatchResult | null = null;
    if (transaction instanceof CreditCardTransaction) {
      const vendorCategory = this.extractVendorCategory(transaction);
      if (vendorCategory) {
        vendorMatch = await this.fuzzyService
          .scoreVendorCategoryAgainstCategories(
            vendorCategory,
            categories
          );
      }
    }
    
    // Step 3: Apply decision hierarchy
    const decision = await this.decisionEngine.determineMainCategory(
      descriptionMatches,
      vendorMatch,
      {
        description: this.config.descriptionThreshold,
        vendor: this.config.vendorThreshold,
      }
    );
    
    // Step 4: Persist scores for analysis
    await this.categoryScoreRepository.recordScores({
      transactionId: transaction.id,
      descriptionScores: descriptionMatches,
      vendorScore: vendorMatch,
      decision,
    });
    
    this.logger.debug('Categorized transaction', {
      description: transaction.description,
      mainCategory: decision.mainCategoryId,
      confidence: decision.confidence,
      reason: decision.reason,
      source: decision.source,
    });
    
    return {
      mainCategoryId: decision.mainCategoryId,
      allCategoryIds: [
        decision.mainCategoryId,
        ...decision.candidates.map(c => c.categoryId).filter(id => id !== decision.mainCategoryId),
      ],
      scores: {
        description: descriptionMatches,
        vendor: vendorMatch,
      },
      decision,
    };
  }

  private extractVendorCategory(txn: CreditCardTransaction): string | null {
    if (txn instanceof IsracardTransaction) {
      return txn.enrichmentData.sector;
    }
    if (txn instanceof MaxTransaction) {
      return txn.enrichmentData.maxCategoryId?.toString();
    }
    if (txn instanceof VisaCalTransaction) {
      return txn.enrichmentData.merchantMetadata?.branchCode;
    }
    return null;
  }
}
```

### User Override Endpoint

```typescript
// routes/transactions.ts

router.post('/transactions/:id/category', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { mainCategoryId } = req.body;
  
  // Get current transaction
  const transaction = await transactionRepository.getById(id);
  
  // Update categories
  await transactionCategoryRepository.setMainCategory(
    id,
    mainCategoryId,
    {
      isManual: true,
      source: 'user',
      timestamp: new Date(),
    }
  );
  
  // Log override for analysis
  await categoryScoreRepository.recordUserOverride({
    transactionId: id,
    previousMainCategoryId: transaction.mainCategoryId,
    newMainCategoryId: mainCategoryId,
    userId: req.user.id,
    timestamp: new Date(),
  });
  
  res.json({
    success: true,
    message: 'Category updated',
    transaction: await transactionRepository.getById(id),
  });
});
```

---

## Summary of Changes

### What Stays the Same
- ✅ Basic transaction enrichment (Max, Visa Cal)
- ✅ Keyword-based fallback categorization
- ✅ Transaction model inheritance

### What Changes
- 🔄 Enrichment execution: Optional async background job (not blocking)
- 🔄 Categorization: Now fuzzy-based with vendor awareness
- 🔄 User control: Allow multi-categories + manual override
- 🔄 Transparency: Show confidence scores & reasoning

### New Components
- 📦 FuzzyMatchingService
- 📦 CategorizeDecisionEngine
- 📦 CategoryScoreRepository
- 📦 User override endpoint

### Performance Profile
- **Scrape time**: 5-10 seconds (enrichment async)
- **Categorization**: 50-200ms (local fuzzy matching)
- **Enrichment job**: Runs async, ~50-100 seconds for 500 transactions

---

## Implementation Readiness

**Ready to Start:**
1. ✅ Fuzzy matching service (use fuzzywuzzy library)
2. ✅ Decision engine (hierarchy logic)
3. ✅ Database schema updates
4. ✅ Background job infrastructure
5. ✅ User override endpoint

**Libraries Needed:**
```json
{
  "fuzzywuzzy": "^1.0.0",
  "python-Levenshtein": "^0.20.0"  // Optional: faster fuzzywuzzy
}
```

**Timeline Estimate:**
- Week 1: Fuzzy matching + decision engine
- Week 2: Database + background jobs
- Week 3: User override API
- Week 4: Testing & optimization

---

## Open Questions for Review

1. **Threshold Values**: Acceptable values for description (75) and vendor (60)?
2. **10% Multiplier**: Should description need to exceed vendor by 10%, 15%, or other?
3. **Background Job**: Use task queue (Bull, RabbitMQ) or cron jobs?
4. **Override Logging**: How detailed should audit trail be?
5. **User Feedback**: Should users see fuzzy match scores in UI, or just category options?
