import bcrypt from 'bcrypt';
import { Logger } from '../utils/logger';
import { UserRepository } from '../repositories/user.repository';
import { User } from '../types';
import { randomUUID } from 'crypto';

export interface Session {
  sessionId: string;
  userId: string;
  username: string;
  createdAt: Date;
  expiresAt: Date;
}

export class AuthService {
  private readonly SALT_ROUNDS = 10;
  private readonly SESSION_DURATION_HOURS = 24;
  private activeSessions: Map<string, Session> = new Map();

  constructor(
    private logger: Logger,
    private userRepository: UserRepository
  ) {}

  async register(username: string, password: string): Promise<{ user: User; session: Session }> {
    this.logger.securityLog('User registration attempt', username);

    const existingUser = this.userRepository.findByUsername(username);
    if (existingUser) {
      this.logger.securityLog('Registration failed: username already exists', username);
      throw new Error('Username already exists');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);
    const user = this.userRepository.create(username, passwordHash);

    const session = this.createSession(user);

    this.logger.securityLog('User registered successfully', username, {
      userId: user.id,
      sessionId: session.sessionId,
    });

    return { user, session };
  }

  async login(username: string, password: string): Promise<Session> {
    this.logger.securityLog('Login attempt', username);

    const user = this.userRepository.findByUsername(username);
    if (!user) {
      this.logger.securityLog('Login failed: user not found', username);
      throw new Error('Invalid username or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      this.logger.securityLog('Login failed: invalid password', username);
      throw new Error('Invalid username or password');
    }

    this.userRepository.updateLastLogin(user.id);

    const session = this.createSession(user);

    this.logger.securityLog('Login successful', username, {
      userId: user.id,
      sessionId: session.sessionId,
    });

    return session;
  }

  logout(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      this.activeSessions.delete(sessionId);
      this.logger.securityLog('User logged out', session.username, {
        userId: session.userId,
        sessionId,
      });
    }
  }

  validateSession(sessionId: string): Session | null {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      return null;
    }

    if (new Date() > session.expiresAt) {
      this.activeSessions.delete(sessionId);
      this.logger.securityLog('Session expired', session.username, {
        userId: session.userId,
        sessionId,
      });
      return null;
    }

    return session;
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isOldPasswordValid) {
      this.logger.securityLog('Password change failed: invalid old password', user.username, {
        userId,
      });
      throw new Error('Invalid old password');
    }

    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    this.userRepository.updatePassword(userId, newPasswordHash);

    this.invalidateUserSessions(userId);

    this.logger.securityLog('Password changed successfully', user.username, {
      userId,
    });
  }

  listUsers(): User[] {
    return this.userRepository.list();
  }

  private createSession(user: User): Session {
    const sessionId = randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(
      createdAt.getTime() + this.SESSION_DURATION_HOURS * 60 * 60 * 1000
    );

    const session: Session = {
      sessionId,
      userId: user.id,
      username: user.username,
      createdAt,
      expiresAt,
    };

    this.activeSessions.set(sessionId, session);

    return session;
  }

  private invalidateUserSessions(userId: string): void {
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  cleanupExpiredSessions(): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now > session.expiresAt) {
        this.activeSessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info(`Cleaned up ${cleanedCount} expired sessions`);
    }

    return cleanedCount;
  }
}
