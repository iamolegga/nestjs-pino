import { LoggerOptions } from './logger-options.interface';

export interface LoggerOptionsFactory {
  createLoggerOptions(): Promise<LoggerOptions> | LoggerOptions;
}
