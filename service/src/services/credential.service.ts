import { EncryptionService, EncryptionResult, DecryptionInput } from './encryption.service';

export interface UserCredentialInput {
  username: string;
  password: string;
}

export interface CredentialData {
  username?: string;
  password?: string;
  userCode?: string;
  nationalId?: string;
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
    } else {
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

  validateCredentials(input: UserCredentialInput, _companyId: string): boolean {
    return !!(input.username && input.password);
  }
}
