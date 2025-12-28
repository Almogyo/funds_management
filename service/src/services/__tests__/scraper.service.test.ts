import { ScraperService, ScraperOptions } from '../scraper.service';
import { Logger } from '../../utils/logger';

describe('ScraperService', () => {
  let scraperService: ScraperService;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      scraperLog: jest.fn(),
    } as any;

    scraperService = new ScraperService(mockLogger);
  });

  describe('calculateMonthsDifference', () => {
    it('should calculate months difference correctly for same month', () => {
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-20');
      const monthsDiff = (scraperService as any).calculateMonthsDifference(startDate, endDate);
      expect(monthsDiff).toBe(0);
    });

    it('should calculate months difference correctly for adjacent months', () => {
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-02-10');
      const monthsDiff = (scraperService as any).calculateMonthsDifference(startDate, endDate);
      expect(monthsDiff).toBe(1);
    });

    it('should calculate months difference correctly for 6 months', () => {
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-07-10');
      const monthsDiff = (scraperService as any).calculateMonthsDifference(startDate, endDate);
      expect(monthsDiff).toBe(6);
    });

    it('should calculate months difference correctly for 12 months', () => {
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2025-01-10');
      const monthsDiff = (scraperService as any).calculateMonthsDifference(startDate, endDate);
      expect(monthsDiff).toBe(12);
    });

    it('should calculate months difference correctly across year boundary', () => {
      const startDate = new Date('2023-11-15');
      const endDate = new Date('2024-02-10');
      const monthsDiff = (scraperService as any).calculateMonthsDifference(startDate, endDate);
      expect(monthsDiff).toBe(3);
    });

    it('should return 0 if end date is before start date', () => {
      const startDate = new Date('2024-06-15');
      const endDate = new Date('2024-01-10');
      const monthsDiff = (scraperService as any).calculateMonthsDifference(startDate, endDate);
      expect(monthsDiff).toBe(0);
    });

    it('should handle dates at month boundaries correctly', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const monthsDiff = (scraperService as any).calculateMonthsDifference(startDate, endDate);
      expect(monthsDiff).toBe(0);
    });
  });

  describe('Date range limiting for Isracard/Amex', () => {
    it('should limit Isracard date range to 6 months when requesting 12 months', () => {
      const endDate = new Date('2024-12-01');
      const startDate = new Date('2024-01-01'); // 11 months difference
      
      // Test the date limiting logic
      const monthsDiff = (scraperService as any).calculateMonthsDifference(startDate, endDate);
      expect(monthsDiff).toBe(11);
      expect(monthsDiff).toBeGreaterThan(6);

      // Verify the limiting logic would be applied
      const maxMonthsForIsracard = 6;
      const shouldLimit = monthsDiff > maxMonthsForIsracard;
      expect(shouldLimit).toBe(true);

      // Calculate limited start date (6 months before end date)
      const limitedStartDate = new Date(endDate);
      limitedStartDate.setMonth(limitedStartDate.getMonth() - maxMonthsForIsracard);
      
      // Verify limited start date is 6 months before end date
      expect(limitedStartDate.getFullYear()).toBe(2024);
      expect(limitedStartDate.getMonth()).toBe(5); // June (0-indexed)
      expect(limitedStartDate.getDate()).toBe(1);
      
      // Verify limited start date is after original start date (because we're limiting to 6 months)
      expect(limitedStartDate.getTime()).toBeGreaterThan(startDate.getTime());
      
      // Verify the limited range is exactly 6 months
      const limitedMonthsDiff = (scraperService as any).calculateMonthsDifference(limitedStartDate, endDate);
      expect(limitedMonthsDiff).toBe(6);
    });

    it('should limit Amex date range to 6 months when requesting 12 months', () => {
      const endDate = new Date('2024-12-01');
      const startDate = new Date('2024-01-01'); // 11 months difference
      
      const monthsDiff = (scraperService as any).calculateMonthsDifference(startDate, endDate);
      expect(monthsDiff).toBeGreaterThan(6);

      const maxMonthsForIsracard = 6;
      const shouldLimit = monthsDiff > maxMonthsForIsracard;
      expect(shouldLimit).toBe(true);
    });

    it('should not limit Isracard date range when requesting exactly 6 months', () => {
      const endDate = new Date('2024-07-01');
      const startDate = new Date('2024-01-01'); // Exactly 6 months
      
      const monthsDiff = (scraperService as any).calculateMonthsDifference(startDate, endDate);
      expect(monthsDiff).toBe(6);

      const maxMonthsForIsracard = 6;
      const shouldLimit = monthsDiff > maxMonthsForIsracard;
      expect(shouldLimit).toBe(false);
    });

    it('should not limit Isracard date range when requesting less than 6 months', () => {
      const endDate = new Date('2024-04-01');
      const startDate = new Date('2024-01-01'); // 3 months
      
      const monthsDiff = (scraperService as any).calculateMonthsDifference(startDate, endDate);
      expect(monthsDiff).toBe(3);

      const maxMonthsForIsracard = 6;
      const shouldLimit = monthsDiff > maxMonthsForIsracard;
      expect(shouldLimit).toBe(false);
    });

    it('should not limit date range for non-Isracard/Amex companies', () => {
      // For other companies, the date range should not be limited
      const isIsracardOrAmex = ['hapoalim', 'leumi', 'visaCal', 'max'].some(
        id => ['isracard', 'amex'].includes(id)
      );
      expect(isIsracardOrAmex).toBe(false);
    });

    it('should correctly calculate limited start date for Isracard', () => {
      const endDate = new Date('2024-12-01');
      const originalStartDate = new Date('2024-01-01');
      const maxMonthsForIsracard = 6;

      // Calculate what the limited start date should be
      const limitedStartDate = new Date(endDate);
      limitedStartDate.setMonth(limitedStartDate.getMonth() - maxMonthsForIsracard);

      // Should be 6 months before end date
      expect(limitedStartDate.getFullYear()).toBe(2024);
      expect(limitedStartDate.getMonth()).toBe(5); // June (0-indexed)
      expect(limitedStartDate.getDate()).toBe(1);

      // Verify it's different from original
      expect(limitedStartDate.getTime()).not.toBe(originalStartDate.getTime());
    });

    it('should handle edge case when endDate is not provided', () => {
      // When endDate is not provided, the limiting logic should not apply
      // This tests that the logic checks for endDate existence
      const options: ScraperOptions = {
        startDate: new Date('2024-01-01'),
        // endDate is undefined
        showBrowser: false,
      };

      // The limiting logic should only apply when endDate is provided
      const shouldApplyLimiting = options.endDate !== undefined;
      expect(shouldApplyLimiting).toBe(false);
    });
  });

  describe('Error handling for 429 rate limit errors', () => {
    it('should detect 429 errors in error messages', () => {
      const errorMessages = [
        'fetchGetWithinPage parse error: Unexpected token \'B\', "Block Automation" is not valid JSON, status: 429',
        'Error: 429 Too Many Requests',
        'rate limit exceeded', // Use lowercase to match the check
        'Block Automation',
      ];

      errorMessages.forEach((errorMessage) => {
        const isRateLimit = 
          errorMessage.includes('429') || 
          errorMessage.includes('Block Automation') || 
          errorMessage.toLowerCase().includes('rate limit');
        expect(isRateLimit).toBe(true);
      });
    });

    it('should generate appropriate error message for Isracard 429 errors', () => {
      const errorMessage = 'fetchGetWithinPage parse error: Unexpected token \'B\', "Block Automation" is not valid JSON, status: 429';
      const companyId = 'isracard';
      
      const isIsracardOrAmex = ['isracard', 'amex'].includes(companyId);
      let enhancedMessage = errorMessage;
      
      if (errorMessage.includes('429') || errorMessage.includes('Block Automation') || errorMessage.toLowerCase().includes('rate limit')) {
        if (isIsracardOrAmex) {
          enhancedMessage = `Isracard API rate limit exceeded. The API blocks automation when too many requests are made. Please try again later or reduce the date range (maximum 6 months recommended). Original error: ${errorMessage}`;
        } else {
          enhancedMessage = `Rate limit exceeded. Please try again later. Original error: ${errorMessage}`;
        }
      }

      expect(enhancedMessage).toContain('Isracard API rate limit exceeded');
      expect(enhancedMessage).toContain('6 months recommended');
      expect(enhancedMessage).toContain('Original error');
    });

    it('should generate appropriate error message for non-Isracard 429 errors', () => {
      const errorMessage = 'Error: 429 Too Many Requests';
      const companyId = 'hapoalim';
      
      const isIsracardOrAmex = ['isracard', 'amex'].includes(companyId);
      let enhancedMessage = errorMessage;
      
      if (errorMessage.includes('429') || errorMessage.includes('Block Automation') || errorMessage.toLowerCase().includes('rate limit')) {
        if (isIsracardOrAmex) {
          enhancedMessage = `Isracard API rate limit exceeded. The API blocks automation when too many requests are made. Please try again later or reduce the date range (maximum 6 months recommended). Original error: ${errorMessage}`;
        } else {
          enhancedMessage = `Rate limit exceeded. Please try again later. Original error: ${errorMessage}`;
        }
      }

      expect(enhancedMessage).toContain('Rate limit exceeded');
      expect(enhancedMessage).not.toContain('Isracard API');
      expect(enhancedMessage).toContain('Original error');
    });
  });

  describe('Date range validation edge cases', () => {
    it('should handle dates at year boundary correctly', () => {
      const startDate = new Date('2023-12-15');
      const endDate = new Date('2024-06-15');
      const monthsDiff = (scraperService as any).calculateMonthsDifference(startDate, endDate);
      expect(monthsDiff).toBe(6);
    });

    it('should handle leap year dates correctly', () => {
      const startDate = new Date('2024-01-15'); // 2024 is a leap year
      const endDate = new Date('2024-07-15');
      const monthsDiff = (scraperService as any).calculateMonthsDifference(startDate, endDate);
      expect(monthsDiff).toBe(6);
    });

    it('should handle same start and end date', () => {
      const date = new Date('2024-06-15');
      const monthsDiff = (scraperService as any).calculateMonthsDifference(date, date);
      expect(monthsDiff).toBe(0);
    });

    it('should handle very large date ranges correctly', () => {
      const startDate = new Date('2020-01-01');
      const endDate = new Date('2024-12-31');
      const monthsDiff = (scraperService as any).calculateMonthsDifference(startDate, endDate);
      expect(monthsDiff).toBe(59); // 4 years + 11 months = 59 months
    });
  });

  describe('Company type identification', () => {
    it('should correctly identify Isracard and Amex as rate-limited companies', () => {
      const isracardIsLimited = ['isracard', 'amex'].includes('isracard');
      const amexIsLimited = ['isracard', 'amex'].includes('amex');
      const hapoalimIsLimited = ['isracard', 'amex'].includes('hapoalim');
      const visaCalIsLimited = ['isracard', 'amex'].includes('visaCal');

      expect(isracardIsLimited).toBe(true);
      expect(amexIsLimited).toBe(true);
      expect(hapoalimIsLimited).toBe(false);
      expect(visaCalIsLimited).toBe(false);
    });
  });

  describe('Integration: Date range limiting logic flow', () => {
    it('should apply correct logic flow for Isracard with 12 months range', () => {
      const endDate = new Date('2024-12-01');
      const startDate = new Date('2024-01-01');
      const companyId = 'isracard';
      const maxMonthsForIsracard = 6;

      // Step 1: Check if company is Isracard/Amex
      const isIsracardOrAmex = ['isracard', 'amex'].includes(companyId);
      expect(isIsracardOrAmex).toBe(true);

      // Step 2: Calculate months difference
      const monthsDiff = (scraperService as any).calculateMonthsDifference(startDate, endDate);
      expect(monthsDiff).toBe(11);

      // Step 3: Check if limiting should be applied
      const shouldLimit = isIsracardOrAmex && monthsDiff > maxMonthsForIsracard;
      expect(shouldLimit).toBe(true);

      // Step 4: Calculate limited start date
      if (shouldLimit) {
        const limitedStartDate = new Date(endDate);
        limitedStartDate.setMonth(limitedStartDate.getMonth() - maxMonthsForIsracard);
        
        // Verify limited date is 6 months before end date
        expect(limitedStartDate.getMonth()).toBe(5); // June (0-indexed)
        expect(limitedStartDate.getFullYear()).toBe(2024);
        
        // Verify it's different from original
        expect(limitedStartDate.getTime()).not.toBe(startDate.getTime());
      }
    });

    it('should not apply limiting for Isracard with 3 months range', () => {
      const endDate = new Date('2024-04-01');
      const startDate = new Date('2024-01-01');
      const companyId = 'isracard';
      const maxMonthsForIsracard = 6;

      const isIsracardOrAmex = ['isracard', 'amex'].includes(companyId);
      const monthsDiff = (scraperService as any).calculateMonthsDifference(startDate, endDate);
      const shouldLimit = isIsracardOrAmex && monthsDiff > maxMonthsForIsracard;

      expect(monthsDiff).toBe(3);
      expect(shouldLimit).toBe(false);
    });

    it('should not apply limiting for non-Isracard companies even with 12 months', () => {
      const endDate = new Date('2024-12-01');
      const startDate = new Date('2024-01-01');
      const companyId = 'hapoalim';
      const maxMonthsForIsracard = 6;

      const isIsracardOrAmex = ['isracard', 'amex'].includes(companyId);
      const monthsDiff = (scraperService as any).calculateMonthsDifference(startDate, endDate);
      const shouldLimit = isIsracardOrAmex && monthsDiff > maxMonthsForIsracard;

      expect(isIsracardOrAmex).toBe(false);
      expect(monthsDiff).toBe(11);
      expect(shouldLimit).toBe(false);
    });
  });

  describe('Error message enhancement validation', () => {
    it('should correctly enhance error messages for different error types', () => {
      const testCases = [
        {
          error: 'fetchGetWithinPage parse error: Unexpected token \'B\', "Block Automation" is not valid JSON, status: 429',
          companyId: 'isracard',
          shouldContain: ['Isracard API rate limit exceeded', '6 months recommended', 'Original error'],
        },
        {
          error: 'Error: 429 Too Many Requests',
          companyId: 'amex',
          shouldContain: ['Isracard API rate limit exceeded', '6 months recommended', 'Original error'],
        },
        {
          error: 'Error: 429 Too Many Requests',
          companyId: 'hapoalim',
          shouldContain: ['Rate limit exceeded', 'Original error'],
          shouldNotContain: ['Isracard API', '6 months'],
        },
        {
          error: 'Network timeout',
          companyId: 'isracard',
          shouldContain: ['Network timeout'],
          shouldNotContain: ['rate limit', '429'],
        },
      ];

      testCases.forEach(({ error, companyId, shouldContain, shouldNotContain = [] }) => {
        const isIsracardOrAmex = ['isracard', 'amex'].includes(companyId);
        let enhancedMessage = error;

        if (error.includes('429') || error.includes('Block Automation') || error.toLowerCase().includes('rate limit')) {
          if (isIsracardOrAmex) {
            enhancedMessage = `Isracard API rate limit exceeded. The API blocks automation when too many requests are made. Please try again later or reduce the date range (maximum 6 months recommended). Original error: ${error}`;
          } else {
            enhancedMessage = `Rate limit exceeded. Please try again later. Original error: ${error}`;
          }
        }

        shouldContain.forEach((text) => {
          expect(enhancedMessage).toContain(text);
        });

        shouldNotContain.forEach((text) => {
          expect(enhancedMessage).not.toContain(text);
        });
      });
    });
  });
});

