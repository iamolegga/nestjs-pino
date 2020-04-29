import { Inject, Injectable, LoggerService } from '@nestjs/common';

import { LOGGER_OPTIONS } from '../constants';
import { LoggerOptions } from '../interfaces';
import { PinoLogger } from './pino-logger.service';

@Injectable()
export class Logger implements LoggerService {
  private readonly contextName: string;

  constructor(
    private readonly logger: PinoLogger,
    @Inject(LOGGER_OPTIONS) { renameContext }: LoggerOptions,
  ) {
    this.contextName = renameContext || 'context';
  }

  verbose(message: any, context?: string, ...args: any[]) {
    if (context) {
      this.logger.trace({ [this.contextName]: context }, message, ...args);
    } else {
      this.logger.trace(message, ...args);
    }
  }

  debug(message: any, context?: string, ...args: any[]) {
    if (context) {
      this.logger.debug({ [this.contextName]: context }, message, ...args);
    } else {
      this.logger.debug(message, ...args);
    }
  }

  log(message: any, context?: string, ...args: any[]) {
    if (context) {
      this.logger.info({ [this.contextName]: context }, message, ...args);
    } else {
      this.logger.info(message, ...args);
    }
  }

  warn(message: any, context?: string, ...args: any[]) {
    if (context) {
      this.logger.warn({ [this.contextName]: context }, message, ...args);
    } else {
      this.logger.warn(message, ...args);
    }
  }

  error(message: any, trace?: string, context?: string, ...args: any[]) {
    if (context) {
      this.logger.error(
        { [this.contextName]: context, trace },
        message,
        ...args,
      );
    } else if (trace) {
      this.logger.error({ trace }, message, ...args);
    } else {
      this.logger.error(message, ...args);
    }
  }
}
