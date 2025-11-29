import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { Logger } from '../utils/logger';

export class AuthController {
  constructor(
    private authService: AuthService,
    private logger: Logger
  ) {}

  /**
   * @swagger
   * /api/auth/register:
   *   post:
   *     tags: [Authentication]
   *     summary: Register a new user
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - password
   *             properties:
   *               username:
   *                 type: string
   *               password:
   *                 type: string
   *                 format: password
   *     responses:
   *       201:
   *         description: User registered successfully
   *       400:
   *         description: Invalid input or user already exists
   */
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required' });
        return;
      }

      const user = await this.authService.register(username, password);

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          username: user.username,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      this.logger.error('Registration error', { error: message });
      res.status(400).json({ error: message });
    }
  };

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     tags: [Authentication]
   *     summary: Login user
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - password
   *             properties:
   *               username:
   *                 type: string
   *               password:
   *                 type: string
   *                 format: password
   *     responses:
   *       200:
   *         description: Login successful, returns session ID
   *       401:
   *         description: Invalid credentials
   */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required' });
        return;
      }

      const session = await this.authService.login(username, password);

      res.status(200).json({
        message: 'Login successful',
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      this.logger.error('Login error', { error: message });
      res.status(401).json({ error: message });
    }
  };

  /**
   * @swagger
   * /api/auth/logout:
   *   post:
   *     tags: [Authentication]
   *     summary: Logout user
   *     security:
   *       - SessionAuth: []
   *     responses:
   *       200:
   *         description: Logged out successfully
   *       400:
   *         description: Session ID required
   */
  logout = (req: Request, res: Response): void => {
    try {
      const sessionId = req.headers['x-session-id'] as string;

      if (!sessionId) {
        res.status(400).json({ error: 'Session ID required' });
        return;
      }

      this.authService.logout(sessionId);

      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout failed';
      this.logger.error('Logout error', { error: message });
      res.status(500).json({ error: message });
    }
  };

  /**
   * @swagger
   * /api/auth/change-password:
   *   post:
   *     tags: [Authentication]
   *     summary: Change user password
   *     security:
   *       - SessionAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - currentPassword
   *               - newPassword
   *             properties:
   *               currentPassword:
   *                 type: string
   *                 format: password
   *               newPassword:
   *                 type: string
   *                 format: password
   *     responses:
   *       200:
   *         description: Password changed successfully
   *       401:
   *         description: Invalid current password
   */
  changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = (req as any).session?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!oldPassword || !newPassword) {
        res.status(400).json({ error: 'Old and new passwords are required' });
        return;
      }

      await this.authService.changePassword(userId, oldPassword, newPassword);

      res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password change failed';
      this.logger.error('Password change error', { error: message });
      res.status(400).json({ error: message });
    }
  };
}