import chalk from 'chalk';
import fs from 'fs-extra';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let currentLogLevel: LogLevel = 'info';
let logFilePath: string | null = null;

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

export function setLogFilePath(filePath: string): void {
  logFilePath = filePath;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
}

function writeToFile(level: string, message: string): void {
  if (!logFilePath) return;
  const line = `[${new Date().toISOString()}] [${level}] ${message}\n`;
  try {
    fs.appendFileSync(logFilePath, line);
  } catch {
    // Ignore write errors
  }
}

export function gray(message: string, ...args: unknown[]): void {
  if (shouldLog('debug')) {
    console.log(chalk.gray(message), ...args);
    writeToFile('GRAY', message);
  }
}

export function debug(message: string, ...args: unknown[]): void {
  if (shouldLog('debug')) {
    console.log(chalk.gray(`[DEBUG] ${message}`), ...args);
    writeToFile('DEBUG', message);
  }
}

export function info(message: string, ...args: unknown[]): void {
  if (shouldLog('info')) {
    console.log(chalk.blue(`[INFO] ${message}`), ...args);
    writeToFile('INFO', message);
  }
}

export function success(message: string, ...args: unknown[]): void {
  if (shouldLog('info')) {
    console.log(chalk.green(`[OK] ${message}`), ...args);
    writeToFile('OK', message);
  }
}

export function warn(message: string, ...args: unknown[]): void {
  if (shouldLog('warn')) {
    console.warn(chalk.yellow(`[WARN] ${message}`), ...args);
    writeToFile('WARN', message);
  }
}

export function error(message: string, ...args: unknown[]): void {
  if (shouldLog('error')) {
    console.error(chalk.red(`[ERROR] ${message}`), ...args);
    writeToFile('ERROR', message);
  }
}

export const logger = {
  gray,
  debug,
  info,
  success,
  warn,
  error,
  setLogLevel,
  getLogLevel,
  setLogFilePath,
};
