import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { AccountRepository } from '../repositories/account.repository';
import { CredentialRepository } from '../repositories/credential.repository';
import { CategoryScoreRepository } from '../repositories/category-score.repository';
import { CredentialService, UserCredentialInput } from '../services/credential.service';
import { Logger } from '../utils/logger';

export class AccountController {
  constructor(
    private accountRepository: AccountRepository,
    private credentialRepository: CredentialRepository,
    private credentialService: CredentialService,
    private categoryScoreRepository: CategoryScoreRepository,
    private logger: Logger
  ) {}

  /**
   * @swagger
   * /api/accounts:
   *   get:
   *     tags: [Accounts]
   *     summary: Get all accounts for authenticated user
   *     security:
   *       - SessionAuth: []
   *     responses:
   *       200:
   *         description: List of accounts
   *       401:
   *         description: Authentication required
   */
  getAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const accounts = this.accountRepository.findByUserId(userId);

      // Enrich accounts with credential fields (excluding password)
      const enrichedAccounts = accounts.map((a) => {
        const credential = this.credentialRepository.findByUserIdAndAccountName(userId, a.alias);
        let username: string | undefined;
        let id: string | undefined; // For Isracard

        if (credential) {
          try {
            const decrypted = this.credentialService.retrieveCredentials(credential);
            // Extract username/id based on account type
            username = decrypted.username || decrypted.userCode || undefined;
            id = decrypted.id || undefined;
            // Never include password in response
          } catch (error) {
            // If decryption fails, just skip credential fields
            this.logger.warn('Failed to decrypt credentials for account', {
              accountId: a.id,
              accountName: a.alias,
            });
          }
        }

        return {
          id: a.id,
          userId: a.userId,
          accountNumber: a.accountNumber,
          companyId: a.companyId,
          alias: a.alias,
          active: a.active,
          accountType: a.accountType,
          card6Digits: a.card6Digits,
          username, // Include username if available
          userIdNumber: id, // Include id for Isracard if available (renamed to avoid conflict with account id)
          lastScrapedAt: a.lastScrapedAt ? a.lastScrapedAt.getTime() : undefined,
          createdAt: a.createdAt.getTime(),
          updatedAt: a.updatedAt.getTime(),
        };
      });

      res.status(200).json({
        count: enrichedAccounts.length,
        accounts: enrichedAccounts,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch accounts';
      this.logger.error('Get accounts error', { error: message });
      res.status(500).json({ error: message });
    }
  };

  /**
   * @swagger
   * /api/accounts/{companyId}:
   *   post:
   *     tags: [Accounts]
   *     summary: Create a new financial account (bank or credit card)
   *     description: Add a bank account or credit card for transaction scraping. Supports Israeli banks (Hapoalim, Leumi, Discount, Mizrahi, Union, Massad) and credit card companies (VisaCal, Max, Isracard, Amex).
   *     security:
   *       - SessionAuth: []
   *     parameters:
   *       - in: path
   *         name: companyId
   *         required: true
   *         schema:
   *           type: string
   *           enum:
   *             - hapoalim
   *             - leumi
   *             - discount
   *             - mizrahi
   *             - union
   *             - massad
   *             - visaCal
   *             - max
   *             - isracard
   *             - amex
   *         description: Financial institution identifier (bank or credit card company)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - accountNumber
   *               - username
   *               - password
   *             optional:
   *               - alias (for credit cards, defaults to accountNumber if not provided)
   *             properties:
   *               accountNumber:
   *                 type: string
   *                 description: Account number (for banks) or card/account identifier (for credit cards). For credit cards, this is optional and used only for display/identification purposes, not for authentication.
   *                 example: "12345"
   *               alias:
   *                 type: string
   *                 description: Friendly name for this account. For credit cards, this is optional and will default to the account identifier if not provided.
   *                 example: "My Hapoalim Account"
   *               username:
   *                 type: string
   *                 description: Login username/user code (will be converted to userCode for Hapoalim automatically)
   *                 example: "user123"
   *               password:
   *                 type: string
   *                 format: password
   *                 description: Login password
   *                 example: "pass123"
   *     responses:
   *       201:
   *         description: Account created successfully
   *       400:
   *         description: Invalid input or unsupported company
   *       401:
   *         description: Authentication required
   */
  createAccount = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { companyId } = req.params;
      const { accountNumber, alias, username, password, card6Digits, id } = req.body;

      // Validate required fields based on account type
      const isCreditCard = ['isracard', 'amex', 'visaCal', 'max'].includes(companyId);
      
      if (!accountNumber || !password) {
        res.status(400).json({
          error: 'Account number and password are required',
        });
        return;
      }

      // For credit cards, alias is optional - use accountNumber if not provided
      // For banks, alias is required
      const finalAlias = isCreditCard ? (alias || accountNumber) : alias;
      if (!finalAlias) {
        res.status(400).json({
          error: 'Alias is required for bank accounts',
        });
        return;
      }

      // Build credentials object based on account type
      const userCredentials: UserCredentialInput = { 
        username: username || id, // For Isracard, id is used instead of username
        password 
      };

      // Add credit card specific fields
      if (isCreditCard && card6Digits) {
        userCredentials.card6Digits = card6Digits;
      }
      if (companyId === 'isracard' && id) {
        userCredentials.id = id;
      }

      // Validate credentials
      if (!this.credentialService.validateCredentials(userCredentials, companyId)) {
        const requiredFields = companyId === 'isracard' 
          ? 'id (user identification number), card6Digits, and password'
          : companyId === 'amex'
          ? 'username, card6Digits, and password'
          : 'username and password';
        res.status(400).json({ 
          error: `Invalid credentials. Required: ${requiredFields}` 
        });
        return;
      }

      // Create account with card6Digits if provided
      const account = this.accountRepository.create(
        userId, 
        accountNumber, 
        companyId, 
        finalAlias, 
        true,
        card6Digits || null
      );

      const preparedCreds = this.credentialService.prepareStoredCredential(
        userId,
        finalAlias, // Use finalAlias (which defaults to accountNumber for credit cards)
        companyId,
        userCredentials
      );

      const savedCredential = this.credentialRepository.create(
        preparedCreds.userId,
        preparedCreds.accountName,
        preparedCreds.companyId,
        preparedCreds.encryptedData,
        preparedCreds.iv,
        preparedCreds.salt
      );

      // Verify credentials were saved correctly
      const verifyCredential = this.credentialRepository.findByUserIdAndAccountName(
        userId,
        finalAlias
      );

      if (!verifyCredential) {
        this.logger.error('Credential verification failed after creation', {
          userId,
          accountId: account.id,
          accountAlias: finalAlias,
          credentialAccountName: preparedCreds.accountName,
        });
        throw new Error('Failed to verify credentials were saved');
      }

      this.logger.info('Account created', {
        userId,
        accountId: account.id,
        companyId,
        accountType: account.accountType,
        accountAlias: account.alias,
        credentialAccountName: savedCredential.accountName,
        credentialId: savedCredential.id,
      });

      res.status(201).json({
        message: 'Account created successfully',
        account: {
          id: account.id,
          accountNumber: account.accountNumber,
          companyId: account.companyId,
          alias: account.alias,
          active: account.active,
          accountType: account.accountType,
          card6Digits: account.card6Digits,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create account';
      this.logger.error('Create account error', { error: message });
      res.status(500).json({ error: message });
    }
  };

  /**
   * @swagger
   * /api/accounts/{id}:
   *   put:
   *     tags: [Accounts]
   *     summary: Update account details
   *     security:
   *       - SessionAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               alias:
   *                 type: string
   *               active:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Account updated
   *       404:
   *         description: Account not found
   */
  updateAccount = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { alias, active, username, password, card6Digits, userIdNumber } = req.body;

      const account = this.accountRepository.findById(id);
      if (!account) {
        res.status(404).json({ error: 'Account not found' });
        return;
      }

      if (account.userId !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Save old alias before updating (needed for credential lookup)
      const oldAlias = account.alias;
      const aliasChanged = alias !== undefined && alias !== oldAlias;

      // Update account fields
      const updates: any = {};
      if (alias !== undefined) updates.alias = alias;
      if (active !== undefined) updates.active = active;
      if (card6Digits !== undefined) updates.card6Digits = card6Digits;

      this.accountRepository.update(id, updates);

      // If alias changed, update credentials' account_name first
      if (aliasChanged) {
        const existingCredential = this.credentialRepository.findByUserIdAndAccountName(userId, oldAlias);
        if (existingCredential) {
          this.credentialRepository.updateAccountName(existingCredential.id, alias);
          this.logger.info('Updated credential account_name after alias change', {
            userId,
            accountId: id,
            oldAlias,
            newAlias: alias,
          });
        } else {
          this.logger.warn('Credentials not found when updating alias', {
            userId,
            accountId: id,
            oldAlias,
            newAlias: alias,
          });
        }
      }

      // Update credentials if any credential field is provided
      if (username !== undefined || password !== undefined || card6Digits !== undefined || userIdNumber !== undefined) {
        // Use new alias if it was changed, otherwise use old alias
        const credentialAlias = aliasChanged ? alias : oldAlias;
        const existingCredential = this.credentialRepository.findByUserIdAndAccountName(userId, credentialAlias);
        
        if (!existingCredential) {
          res.status(400).json({ error: 'Credentials not found for this account' });
          return;
        }

        // Decrypt existing credentials to merge with updates
        const decryptedCredentials = this.credentialService.retrieveCredentials(existingCredential);
        
        // Build updated credentials object
        const isCreditCard = ['isracard', 'amex', 'visaCal', 'max'].includes(account.companyId);
        const requiresCard6Digits = ['isracard', 'amex'].includes(account.companyId);
        const requiresId = account.companyId === 'isracard';

        // Build updated credentials - use provided values or keep existing ones
        // For password: only use new value if provided and not placeholder, otherwise keep existing
        const isPasswordPlaceholder = password === '********' || password === '';
        const updatedPassword = (password !== undefined && !isPasswordPlaceholder) 
          ? password 
          : (decryptedCredentials.password || '');

        // Get username/id - prefer provided value, fallback to existing
        const existingUsername = decryptedCredentials.username || decryptedCredentials.userCode || decryptedCredentials.id || '';
        const updatedUsername = username !== undefined ? username : existingUsername;

        const updatedCredentials: UserCredentialInput = {
          username: updatedUsername,
          password: updatedPassword,
        };

        // Handle credit card specific fields
        if (isCreditCard) {
          if (requiresCard6Digits) {
            updatedCredentials.card6Digits = card6Digits !== undefined ? card6Digits : (decryptedCredentials.card6Digits || '');
          }
          if (requiresId) {
            // For Isracard, id takes precedence over username
            const existingId = decryptedCredentials.id || decryptedCredentials.username || '';
            updatedCredentials.id = userIdNumber !== undefined ? userIdNumber : existingId;
          }
        }

        // Validate credentials before updating
        if (!this.credentialService.validateCredentials(updatedCredentials, account.companyId)) {
          res.status(400).json({ error: 'Invalid credentials provided' });
          return;
        }

        // Prepare and update encrypted credentials
        // Use new alias if it was changed, otherwise use old alias (credentialAlias already declared above)
        const preparedCreds = this.credentialService.prepareStoredCredential(
          userId,
          credentialAlias,
          account.companyId,
          updatedCredentials
        );

        this.credentialRepository.update(
          existingCredential.id,
          preparedCreds.encryptedData,
          preparedCreds.iv,
          preparedCreds.salt
        );

        this.logger.info('Credentials updated', {
          userId,
          accountId: id,
          accountName: account.alias,
          fieldsUpdated: {
            username: username !== undefined,
            password: password !== undefined && !isPasswordPlaceholder,
            card6Digits: card6Digits !== undefined,
            userIdNumber: userIdNumber !== undefined,
          },
        });
      }

      this.logger.info('Account updated', {
        userId,
        accountId: id,
        updates,
      });

      res.status(200).json({ message: 'Account updated successfully' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update account';
      this.logger.error('Update account error', { error: message });
      res.status(500).json({ error: message });
    }
  };

  /**
   * @swagger
   * /api/accounts/{id}:
   *   delete:
   *     tags: [Accounts]
   *     summary: Delete an account
   *     security:
   *       - SessionAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Account deleted
   *       404:
   *         description: Account not found
   */
  deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;

      const account = this.accountRepository.findById(id);
      if (!account) {
        res.status(404).json({ error: 'Account not found' });
        return;
      }

      if (account.userId !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Delete in proper order to avoid foreign key constraint errors:
      // 1. Delete category scores (has FK to account_id)
      // 2. Delete credentials (linked by account_name, not FK)
      // 3. Delete account (will cascade to transactions and transaction_categories)

      try {
        // Delete category scores first
        this.categoryScoreRepository.deleteByAccountId(id);

        // Delete credentials (they're linked by account_name, not FK)
        const credential = this.credentialRepository.findByUserIdAndAccountName(userId, account.alias);
        if (credential) {
          this.credentialRepository.delete(credential.id);
        }

        // Delete account (CASCADE will handle transactions and transaction_categories)
        this.accountRepository.delete(id);

        this.logger.info('Account deleted', {
          userId,
          accountId: id,
          accountAlias: account.alias,
        });

        res.status(200).json({ message: 'Account deleted successfully' });
      } catch (error: any) {
        // If foreign key constraint error, provide more helpful message
        if (error.code === 'SQLITE_CONSTRAINT' || error.message?.includes('FOREIGN KEY')) {
          this.logger.error('Foreign key constraint error during account deletion', {
            accountId: id,
            error: error.message,
          });
          res.status(500).json({ 
            error: 'Cannot delete account: related data still exists. Please ensure all related transactions are deleted first.' 
          });
          return;
        }
        throw error;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete account';
      this.logger.error('Delete account error', { error: message });
      res.status(500).json({ error: message });
    }
  };
}