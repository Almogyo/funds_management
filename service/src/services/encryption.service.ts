import crypto from 'crypto';

export interface EncryptionResult {
  encryptedData: string;
  iv: string;
  salt: string;
}

export interface DecryptionInput {
  encryptedData: string;
  iv: string;
  salt: string;
}

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly saltLength = 64;
  private readonly iterations = 100000;
  private readonly digest = 'sha512';

  private masterKey: string;

  constructor(masterKey: string) {
    if (!masterKey || masterKey.length < 32) {
      throw new Error('Master key must be at least 32 characters long');
    }
    this.masterKey = masterKey;
  }

  private deriveKey(salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(this.masterKey, salt, this.iterations, this.keyLength, this.digest);
  }

  encrypt(plainText: string): EncryptionResult {
    const salt = crypto.randomBytes(this.saltLength);
    const key = this.deriveKey(salt);
    const iv = crypto.randomBytes(this.ivLength);

    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();
    const encryptedWithTag = encrypted + authTag.toString('hex');

    return {
      encryptedData: encryptedWithTag,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
    };
  }

  decrypt(input: DecryptionInput): string {
    const salt = Buffer.from(input.salt, 'hex');
    const key = this.deriveKey(salt);
    const iv = Buffer.from(input.iv, 'hex');

    const authTagLength = 32;
    const encryptedData = input.encryptedData.slice(0, -authTagLength);
    const authTag = Buffer.from(input.encryptedData.slice(-authTagLength), 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  encryptObject<T>(obj: T): EncryptionResult {
    const jsonString = JSON.stringify(obj);
    return this.encrypt(jsonString);
  }

  decryptObject<T>(input: DecryptionInput): T {
    const jsonString = this.decrypt(input);
    return JSON.parse(jsonString) as T;
  }

  hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}