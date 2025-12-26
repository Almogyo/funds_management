import winston from 'winston';
import path from 'path';
import fs from 'fs';

export interface LoggerConfig {
  level: string;
  filePath: string;
  console: boolean;
  file: boolean;
}

export class Logger {
  private logger: winston.Logger;
  private config: LoggerConfig;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.ensureLogDirectory();
    this.logger = this.createLogger();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.config.filePath)) {
      fs.mkdirSync(this.config.filePath, { recursive: true });
    }
  }

  private createLogger(): winston.Logger {
    const transports: winston.transport[] = [];

    if (this.config.console) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(
              ({ timestamp, level, message, context, correlationId, ...meta }) => {
                let log = `${timestamp} [${level}]`;
                if (correlationId) log += ` [${correlationId}]`;
                if (context) log += ` [${context}]`;
                log += `: ${message}`;
                if (Object.keys(meta).length > 0) {
                  log += ` ${JSON.stringify(meta)}`;
                }
                return log;
              }
            )
          ),
        })
      );
    }

    if (this.config.file) {
      transports.push(
        new winston.transports.File({
          filename: path.join(this.config.filePath, 'error.log'),
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );

      transports.push(
        new winston.transports.File({
          filename: path.join(this.config.filePath, 'combined.log'),
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );
    }

    // If no transports are configured, add a silent transport to prevent Winston warnings
    if (transports.length === 0) {
      transports.push(
        new winston.transports.Console({
          silent: true, // Silent transport that discards all logs
        })
      );
    }

    return winston.createLogger({
      level: this.config.level,
      transports,
    });
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  scraperLog(action: string, accountName: string, meta?: any): void {
    this.logger.info(`[SCRAPER] ${action}`, {
      context: 'SCRAPER',
      accountName,
      ...meta,
    });
  }

  calculationLog(operation: string, meta?: any): void {
    this.logger.info(`[ANALYTICS] ${operation}`, {
      context: 'ANALYTICS',
      ...meta,
    });
  }

  securityLog(event: string, username?: string, meta?: any): void {
    this.logger.info(`[AUTH] ${event}`, {
      context: 'AUTH',
      username,
      ...meta,
    });
  }

  dbLog(operation: string, meta?: any): void {
    this.logger.debug(`[DATABASE] ${operation}`, {
      context: 'DATABASE',
      ...meta,
    });
  }

  apiLog(method: string, path: string, statusCode: number, duration: number, meta?: any): void {
    // Only log non-GET requests and error responses
    if (method === 'GET' && statusCode < 400) {
      return;
    }
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.logger.log(level, `[API] ${method} ${path} ${statusCode} ${duration}ms`, {
      context: 'API',
      method,
      path,
      statusCode,
      duration,
      ...meta,
    });
  }

  withCorrelationId(correlationId: string): Logger {
    const loggerCopy = Object.create(this);
    loggerCopy.logger = this.logger.child({ correlationId });
    return loggerCopy;
  }

  withContext(context: string): Logger {
    const loggerCopy = Object.create(this);
    loggerCopy.logger = this.logger.child({ context });
    return loggerCopy;
  }
}

let globalLogger: Logger | null = null;

export function initializeLogger(config: LoggerConfig): Logger {
  globalLogger = new Logger(config);
  return globalLogger;
}

export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger({
      level: 'info',
      filePath: './logs',
      console: true,
      file: false,
    });
  }
  return globalLogger;
}