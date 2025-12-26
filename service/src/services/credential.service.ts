import { EncryptionService, EncryptionResult, DecryptionInput } from './encryption.service';

export interface UserCredentialInput {
  username: string;
  password: string;
  card6Digits?: string; // For Isracard/Amex
  id?: string; // For Isracard (user identification number)
}

export interface CredentialData {
  username?: string;
  password?: string;
  userCode?: string;
  nationalId?: string;
  id?: string; // For Isracard
  card6Digits?: string; // For Isracard/Amex
  [key: string]: string | undefined;
}

export interface StoredCredential {
  id: string;
  userId: string;
  accountName: string;
  companyId: string;
  encryptedData: string;
  iv: string;
  salt: string;
  createdAt: Date;
  updatedAt: Date;
}

export class CredentialService {
  private encryptionService: EncryptionService;

  constructor(masterKey: string) {
    this.encryptionService = new EncryptionService(masterKey);
  }

  encryptCredentials(credentials: CredentialData): EncryptionResult {
    return this.encryptionService.encryptObject(credentials);
  }

  decryptCredentials(input: DecryptionInput): CredentialData {
    return this.encryptionService.decryptObject<CredentialData>(input);
  }

  normalizeUserInput(input: UserCredentialInput, companyId: string): CredentialData {
    const normalized: CredentialData = {};

    if (companyId === 'hapoalim') {
      normalized.userCode = input.username;
      normalized.password = input.password;
    } else if (companyId === 'isracard') {
      // Isracard requires: id (user identification number), card6Digits, password
      normalized.id = input.id || input.username; // Use id if provided, fallback to username
      normalized.card6Digits = input.card6Digits;
      normalized.password = input.password;
    } else if (companyId === 'amex') {
      // Amex requires: username (user identification number), card6Digits, password
      normalized.username = input.username;
      normalized.card6Digits = input.card6Digits;
      normalized.password = input.password;
    } else {
      // Visa Cal, Max, and banks use username/password
      normalized.username = input.username;
      normalized.password = input.password;
    }

    return normalized;
  }

  prepareStoredCredential(
    userId: string,
    accountName: string,
    companyId: string,
    userInput: UserCredentialInput
  ): Omit<StoredCredential, 'id' | 'createdAt' | 'updatedAt'> {
    const normalizedCredentials = this.normalizeUserInput(userInput, companyId);
    const encrypted = this.encryptCredentials(normalizedCredentials);

    return {
      userId,
      accountName,
      companyId,
      encryptedData: encrypted.encryptedData,
      iv: encrypted.iv,
      salt: encrypted.salt,
    };
  }

  retrieveCredentials(stored: StoredCredential): CredentialData {
    return this.decryptCredentials({
      encryptedData: stored.encryptedData,
      iv: stored.iv,
      salt: stored.salt,
    });
  }

  validateCredentials(input: UserCredentialInput, companyId: string): boolean {
    // Basic validation - all require password
    if (!input.password) {
      return false;
    }

    // Isracard requires: id, card6Digits, password
    if (companyId === 'isracard') {
      return !!(input.id || input.username) && !!input.card6Digits && !!input.password;
    }

    // Amex requires: username, card6Digits, password
    if (companyId === 'amex') {
      return !!input.username && !!input.card6Digits && !!input.password;
    }

    // Visa Cal, Max, and banks require: username, password
    return !!input.username && !!input.password;
  }
}
