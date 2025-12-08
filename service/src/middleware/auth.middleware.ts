import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { Logger } from '../utils/logger';

export interface AuthRequest extends Request {
  session?: {
    sessionId: string;
    userId: string;
    username: string;
  };
}

export function createAuthMiddleware(authService: AuthService, logger: Logger) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const sessionId = req.headers['x-session-id'] as string;

    if (!sessionId) {
      logger.securityLog('Auth middleware: No session ID provided');
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const session = authService.validateSession(sessionId);

    if (!session) {
      logger.securityLog('Auth middleware: Invalid or expired session', undefined, {
        sessionId,
      });
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    req.session = {
      sessionId: session.sessionId,
      userId: session.userId,
      username: session.username,
    };

    next();
  };
}