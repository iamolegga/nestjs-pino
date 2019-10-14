import { Injectable, LoggerService, Inject } from "@nestjs/common";
import * as pino from "pino";
import { getValue } from "express-ctx";
import { OPTIONS_PROVIDER_TOKEN, LOGGER_KEY } from "./constants";
import { Params, isPassedLogger } from "./params";

@Injectable()
export class Logger implements LoggerService {
  private readonly outOfContext: pino.Logger;

  constructor(@Inject(OPTIONS_PROVIDER_TOKEN) options: Params) {
    if (Array.isArray(options)) {
      this.outOfContext = pino(...options);
    } else if (isPassedLogger(options)) {
      this.outOfContext = options.logger;
    } else {
      this.outOfContext = pino(options || undefined);
    }
  }

  verbose(message: any, context?: string, ...args: any[]) {
    if (context) {
      this.logger.trace({ context }, message, ...args);
    } else {
      this.logger.trace(message);
    }
  }

  debug(message: any, context?: string, ...args: any[]) {
    if (context) {
      this.logger.debug({ context }, message, ...args);
    } else {
      this.logger.debug(message);
    }
  }

  log(message: any, context?: string, ...args: any[]) {
    if (context) {
      this.logger.info({ context }, message, ...args);
    } else {
      this.logger.info(message);
    }
  }

  warn(message: any, context?: string, ...args: any[]) {
    if (context) {
      this.logger.warn({ context }, message, ...args);
    } else {
      this.logger.warn(message);
    }
  }

  error(message: any, trace?: string, context?: string, ...args: any[]) {
    if (context) {
      this.logger.error({ context, trace }, message, ...args);
    } else if (trace) {
      this.logger.error({ trace }, message);
    } else {
      this.logger.error(message);
    }
  }

  private get logger() {
    return getValue<pino.Logger>(LOGGER_KEY) || this.outOfContext;
  }
}
