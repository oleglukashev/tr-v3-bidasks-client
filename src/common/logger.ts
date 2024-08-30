import * as winston from 'winston';
import { join, basename } from 'path';
require('winston-daily-rotate-file');
const { combine, timestamp, json } = winston.format;

export const loggerNames = {};

export function infoLogger(filepath, text) {
  if (process.env.NODE_ENV === 'development') {
    console.log(text);
  }
  return logger(filepath).info(text);
}

export function errorLogger(filepath, text) {
  if (process.env.NODE_ENV === 'development') {
    console.log(text);
  }
  return logger(filepath, 'error').error(text);
}

export default function logger(filepath: string, level?: string) {
  const filename = basename(filepath);
  const logLevel = level || 'info';
  const loggerNameKey = `${filename}_${logLevel}`;
  if (loggerNames[loggerNameKey]) {
    return loggerNames[loggerNameKey];
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  loggerNames[loggerNameKey] = winston.createLogger({
    level: logLevel, // Set minimum log level (info, debug, etc.)
    format: combine(timestamp(), json()), // Combine timestamp and JSON format
    transports: [
      new winston.transports.Console({
        // Log to console
        format: winston.format.combine(
          winston.format.colorize({ all: true }), // Colorize console logs
          winston.format.simple(), // Simplified console output format
        ),
      }),
      new winston.transports.File({
        // Log to file (optional)
        filename: `${logLevel}.log`, // Customize filename
        dirname: join(__dirname, '../../../', 'logs', filename),
        //level: logLevel // Write only errors to the file (optional)
      }),
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      new winston.transports.DailyRotateFile({
        filename: `${logLevel}-%DATE%.log`,
        dirname: join(__dirname, '../../../', 'logs', filename),
        datePattern: 'YYYY-MM-DD',
        maxSize: '100m',
        zippedArchive: true,
        timestamp: true,
        handleExceptions: true,
        humanReadableUnhandledException: true,
        prettyPrint: true,
        json: true,
        colorize: true,
      }),
    ],
  });

  return loggerNames[loggerNameKey];
}
