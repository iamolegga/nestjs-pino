import { Injectable, LoggerService } from "@nestjs/common";
import { PinoLogger } from "./PinoLogger";

@Injectable()
export class Logger implements LoggerService {
  constructor(private readonly logger: PinoLogger) {}

  verbose(message: any, context?: string, ...args: any[]) {
    if (context) {
      this.logger.trace({ context }, message, ...args);
    } else {
      this.logger.trace(message, ...args);
    }
  }

  debug(message: any, context?: string, ...args: any[]) {
    if (context) {
      this.logger.debug({ context }, message, ...args);
    } else {
      this.logger.debug(message, ...args);
    }
  }

  log(message: any, context?: string, ...args: any[]) {
    if (context) {
      this.logger.info({ context }, message, ...args);
    } else {
      this.logger.info(message, ...args);
    }
  }

  warn(message: any, context?: string, ...args: any[]) {
    if (context) {
      this.logger.warn({ context }, message, ...args);
    } else {
      this.logger.warn(message, ...args);
    }
  }

  error(message: any, trace?: string, context?: string, ...args: any[]) {
    if (context) {
      this.logger.error({ context, trace }, message, ...args);
    } else if (trace) {
      this.logger.error({ trace }, message, ...args);
    } else {
      this.logger.error(message, ...args);
    }
  }
}
