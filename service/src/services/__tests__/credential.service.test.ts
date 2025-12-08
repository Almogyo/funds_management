import { CredentialService } from '../credential.service';
import { StoredCredential } from '../credential.service';

describe('CredentialService', () => {
  let credentialService: CredentialService;
  const masterKey = 'test-master-key-with-minimum-32-characters-required';

  beforeEach(() => {
    credentialService = new CredentialService(masterKey);
  });

  describe('encryptCredentials and decryptCredentials', () => {
    it('should encrypt and decrypt credentials correctly', () => {
      const credentials = {
        username: 'testuser',
        password: 'testpass123',
      };

      const encrypted = credentialService.encryptCredentials(credentials);
      expect(encrypted.encryptedData).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.salt).toBeDefined();

      const decrypted = credentialService.decryptCredentials(encrypted);
      expect(decrypted).toEqual(credentials);
    });

    it('should handle credentials with multiple fields', () => {
      const credentials = {
        username: 'user123',
        password: 'pass456',
        userCode: '789',
        nationalId: '123456789',
      };

      const encrypted = credentialService.encryptCredentials(credentials);
      const decrypted = credentialService.decryptCredentials(encrypted);

      expect(decrypted).toEqual(credentials);
    });
  });

  describe('prepareStoredCredential', () => {
    it('should prepare credential for storage', () => {
      const userId = 'user-123';
      const accountName = 'My Hapoalim Account';
      const companyId = 'hapoalim';
      const credentials = {
        userCode: '12345',
        password: 'secret',
      };

      const stored = credentialService.prepareStoredCredential(
        userId,
        accountName,
        companyId,
        credentials
      );

      expect(stored.userId).toBe(userId);
      expect(stored.accountName).toBe(accountName);
      expect(stored.companyId).toBe(companyId);
      expect(stored.encryptedData).toBeDefined();
      expect(stored.iv).toBeDefined();
      expect(stored.salt).toBeDefined();
    });
  });

  describe('retrieveCredentials', () => {
    it('should retrieve and decrypt stored credentials', () => {
      const credentials = {
        username: 'testuser',
        password: 'testpass',
      };

      const stored = credentialService.prepareStoredCredential(
        'user-1',
        'Test Account',
        'leumi',
        credentials
      );

      const fullStored: StoredCredential = {
        id: 'cred-1',
        ...stored,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const retrieved = credentialService.retrieveCredentials(fullStored);
      expect(retrieved).toEqual(credentials);
    });
  });

  describe('validateCredentials', () => {
    it('should validate hapoalim credentials', () => {
      const validCreds = {
        userCode: '12345',
        password: 'secret',
      };
      const invalidCreds = {
        username: '12345',
      };

      expect(credentialService.validateCredentials(validCreds, 'hapoalim')).toBe(true);
      expect(credentialService.validateCredentials(invalidCreds, 'hapoalim')).toBe(false);
    });

    it('should validate leumi credentials', () => {
      const validCreds = {
        username: 'user123',
        password: 'pass456',
      };
      const invalidCreds = {
        username: 'user123',
      };

      expect(credentialService.validateCredentials(validCreds, 'leumi')).toBe(true);
      expect(credentialService.validateCredentials(invalidCreds, 'leumi')).toBe(false);
    });

    it('should use default validation for unknown companies', () => {
      const validCreds = {
        username: 'user',
        password: 'pass',
      };
      const invalidCreds = {
        username: 'user',
      };

      expect(credentialService.validateCredentials(validCreds, 'unknown-bank')).toBe(true);
      expect(credentialService.validateCredentials(invalidCreds, 'unknown-bank')).toBe(false);
    });
  });
});