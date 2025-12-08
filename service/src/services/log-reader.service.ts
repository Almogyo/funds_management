import fs from 'fs';
import path from 'path';
import readline from 'readline';

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: string;
  [key: string]: any;
}

export class LogReaderService {
  constructor(private logsDirectory: string) {}

  async getRecentLogs(
    limit: number = 100,
    level?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<LogEntry[]> {
    const combinedLogPath = path.join(this.logsDirectory, 'combined.log');

    if (!fs.existsSync(combinedLogPath)) {
      return [];
    }

    const logs: LogEntry[] = [];
    const fileStream = fs.createReadStream(combinedLogPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const logEntry = JSON.parse(line) as LogEntry;

        if (level && logEntry.level !== level) {
          continue;
        }

        if (startDate || endDate) {
          const logDate = new Date(logEntry.timestamp);
          if (startDate && logDate < startDate) continue;
          if (endDate && logDate > endDate) continue;
        }

        logs.push(logEntry);
      } catch (error) {
        continue;
      }
    }

    return logs.slice(-limit).reverse();
  }

  async tailLogs(sinceTimestamp?: string): Promise<LogEntry[]> {
    const combinedLogPath = path.join(this.logsDirectory, 'combined.log');

    if (!fs.existsSync(combinedLogPath)) {
      return [];
    }

    const logs: LogEntry[] = [];
    const fileStream = fs.createReadStream(combinedLogPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    const cutoffTime = sinceTimestamp ? new Date(sinceTimestamp) : null;

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const logEntry = JSON.parse(line) as LogEntry;

        if (cutoffTime) {
          const logTime = new Date(logEntry.timestamp);
          if (logTime <= cutoffTime) {
            continue;
          }
        }

        logs.push(logEntry);
      } catch (error) {
        continue;
      }
    }

    return logs;
  }

  getLogStats(): { size: number; lines: number; lastModified: Date | null } {
    const combinedLogPath = path.join(this.logsDirectory, 'combined.log');

    if (!fs.existsSync(combinedLogPath)) {
      return { size: 0, lines: 0, lastModified: null };
    }

    const stats = fs.statSync(combinedLogPath);
    const content = fs.readFileSync(combinedLogPath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim()).length;

    return {
      size: stats.size,
      lines,
      lastModified: stats.mtime,
    };
  }
}