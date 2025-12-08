import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface GeneratedKeys {
  encryptionKey: string;
  sessionSecret: string;
  jwtSecret: string;
}

export class KeyGenerator {
  private keysDirectory: string;
  private keysFilePath: string;

  constructor() {
    this.keysDirectory = path.join(os.homedir(), '.funds_management_keys');
    this.keysFilePath = path.join(this.keysDirectory, 'encryption_keys.json');
  }

  ensureKeysExist(): GeneratedKeys {
    if (fs.existsSync(this.keysFilePath)) {
      return this.loadKeys();
    }

    return this.generateAndSaveKeys();
  }

  private generateAndSaveKeys(): GeneratedKeys {
    console.log('🔐 Generating new encryption keys...');

    this.ensureKeysDirectory();

    const keys: GeneratedKeys = {
      encryptionKey: this.generateSecureKey(32),
      sessionSecret: this.generateSecureKey(64),
      jwtSecret: this.generateSecureKey(64),
    };

    const keysData = {
      ...keys,
      createdAt: new Date().toISOString(),
      warning: 'DO NOT SHARE OR COMMIT THESE KEYS. Keep this file secure and backed up.',
    };

    fs.writeFileSync(this.keysFilePath, JSON.stringify(keysData, null, 2), { mode: 0o600 });

    try {
      if (process.platform !== 'win32') {
        fs.chmodSync(this.keysFilePath, 0o400);
      }
    } catch (error) {
      console.warn('⚠️  Could not set read-only permissions on keys file');
    }

    console.log(`✅ Keys generated and saved to: ${this.keysFilePath}`);
    console.log('🔒 File permissions: Read-only for owner');
    console.log('⚠️  IMPORTANT: Back up this file in a secure location!');

    return keys;
  }

  private loadKeys(): GeneratedKeys {
    const keysData = JSON.parse(fs.readFileSync(this.keysFilePath, 'utf-8'));
    return {
      encryptionKey: keysData.encryptionKey,
      sessionSecret: keysData.sessionSecret,
      jwtSecret: keysData.jwtSecret,
    };
  }

  private ensureKeysDirectory(): void {
    if (!fs.existsSync(this.keysDirectory)) {
      fs.mkdirSync(this.keysDirectory, { recursive: true, mode: 0o700 });
    }
  }

  private generateSecureKey(length: number): string {
    return crypto.randomBytes(length).toString('hex');
  }

  getKeysFilePath(): string {
    return this.keysFilePath;
  }
}