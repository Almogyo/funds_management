import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { AccountRepository } from '../repositories/account.repository';
import { CredentialRepository } from '../repositories/credential.repository';
import { CredentialService, UserCredentialInput } from '../services/credential.service';
import { Logger } from '../utils/logger';

export class AccountController {
  constructor(
    private accountRepository: AccountRepository,
    private credentialRepository: CredentialRepository,
    private credentialService: CredentialService,
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

      res.status(200).json({
        count: accounts.length,
        accounts: accounts.map((a) => ({
          id: a.id,
          userId: a.userId,
          accountNumber: a.accountNumber,
          companyId: a.companyId,
          alias: a.alias,
          active: a.active,
          accountType: a.accountType,
          card6Digits: a.card6Digits,
          lastScrapedAt: a.lastScrapedAt ? a.lastScrapedAt.getTime() : undefined,
          createdAt: a.createdAt.getTime(),
          updatedAt: a.updatedAt.getTime(),
        })),
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
      const { alias, active } = req.body;

      const account = this.accountRepository.findById(id);
      if (!account) {
        res.status(404).json({ error: 'Account not found' });
        return;
      }

      if (account.userId !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const updates: any = {};
      if (alias !== undefined) updates.alias = alias;
      if (active !== undefined) updates.active = active;

      this.accountRepository.update(id, updates);

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

      this.accountRepository.delete(id);

      const credential = this.credentialRepository.findByUserIdAndAccountName(userId, account.alias);
      if (credential) {
        this.credentialRepository.delete(credential.id);
      }

      this.logger.info('Account deleted', {
        userId,
        accountId: id,
      });

      res.status(200).json({ message: 'Account deleted successfully' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete account';
      this.logger.error('Delete account error', { error: message });
      res.status(500).json({ error: message });
    }
  };
}