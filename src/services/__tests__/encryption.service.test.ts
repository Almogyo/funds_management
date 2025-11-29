import { EncryptionService } from '../encryption.service';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  const masterKey = 'test-master-key-with-minimum-32-characters-required';

  beforeEach(() => {
    encryptionService = new EncryptionService(masterKey);
  });

  describe('constructor', () => {
    it('should throw error if master key is too short', () => {
      expect(() => new EncryptionService('short')).toThrow(
        'Master key must be at least 32 characters long'
      );
    });

    it('should accept valid master key', () => {
      expect(() => new EncryptionService(masterKey)).not.toThrow();
    });
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plainText = 'sensitive data to encrypt';
      const encrypted = encryptionService.encrypt(plainText);

      expect(encrypted.encryptedData).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.encryptedData).not.toBe(plainText);

      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(plainText);
    });

    it('should produce different encrypted values for same input', () => {
      const plainText = 'test data';
      const encrypted1 = encryptionService.encrypt(plainText);
      const encrypted2 = encryptionService.encrypt(plainText);

      expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
    });

    it('should handle special characters and unicode', () => {
      const plainText = 'שלום עולם! 🔐 特殊字符';
      const encrypted = encryptionService.encrypt(plainText);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it('should throw error on tampered encrypted data', () => {
      const plainText = 'secure data';
      const encrypted = encryptionService.encrypt(plainText);

      encrypted.encryptedData = encrypted.encryptedData.slice(0, -2) + 'ff';

      expect(() => encryptionService.decrypt(encrypted)).toThrow();
    });
  });

  describe('encryptObject and decryptObject', () => {
    it('should encrypt and decrypt an object correctly', () => {
      const obj = {
        username: 'testuser',
        password: 'testpass123',
        extra: 'data',
      };

      const encrypted = encryptionService.encryptObject(obj);
      const decrypted = encryptionService.decryptObject(encrypted);

      expect(decrypted).toEqual(obj);
    });

    it('should handle nested objects', () => {
      const obj = {
        user: {
          name: 'John',
          credentials: {
            username: 'john123',
            password: 'secure',
          },
        },
        metadata: {
          createdAt: '2025-11-28',
        },
      };

      const encrypted = encryptionService.encryptObject(obj);
      const decrypted = encryptionService.decryptObject(encrypted);

      expect(decrypted).toEqual(obj);
    });
  });

  describe('hashData', () => {
    it('should produce consistent hash for same input', () => {
      const data = 'data to hash';
      const hash1 = encryptionService.hashData(data);
      const hash2 = encryptionService.hashData(data);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = encryptionService.hashData('data1');
      const hash2 = encryptionService.hashData('data2');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce 64-character hex hash', () => {
      const hash = encryptionService.hashData('test');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate token of default length', () => {
      const token = encryptionService.generateSecureToken();
      expect(token).toHaveLength(64);
    });

    it('should generate token of specified length', () => {
      const token = encryptionService.generateSecureToken(16);
      expect(token).toHaveLength(32);
    });

    it('should generate different tokens each time', () => {
      const token1 = encryptionService.generateSecureToken();
      const token2 = encryptionService.generateSecureToken();

      expect(token1).not.toBe(token2);
    });
  });
});