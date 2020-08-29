import { Injectable, LoggerService, Inject } from "@nestjs/common";
import { PinoLogger } from "./PinoLogger";
import { PARAMS_PROVIDER_TOKEN } from "./constants";
import { Params } from "./params";

@Injectable()
export class Logger implements LoggerService {
  private readonly contextName: string;

  constructor(
    private readonly logger: PinoLogger,
    @Inject(PARAMS_PROVIDER_TOKEN) { renameContext }: Params
  ) {
    this.contextName = renameContext || "context";
  }

  verbose(message: any, context?: string, isTimestampEnabled?: boolean, ...args: any[]) {
    if (context) {
      if (typeof message === 'object') {
        this.logger.trace({[this.contextName]: context, ...message}, ...args);
      } else {
        this.logger.trace({[this.contextName]: context}, message, ...args);
      }
    } else {
      this.logger.trace(message, ...args);
    }
  }

  debug(message: any, context?: string, isTimestampEnabled?: boolean, ...args: any[]) {
    if (context) {
      if (typeof message === 'object') {
        this.logger.debug({[this.contextName]: context, ...message}, ...args);
      } else {
        this.logger.debug({[this.contextName]: context}, message, ...args);
      }
    } else {
      this.logger.debug(message, ...args);
    }
  }

  log(message: any, context?: string, isTimestampEnabled?: boolean, ...args: any[]) {
    if (context) {
      if (typeof message === 'object') {
        this.logger.info({[this.contextName]: context, ...message}, ...args);
      } else {
        this.logger.info({[this.contextName]: context}, message, ...args);
      }
    } else {
      this.logger.info(message, ...args);
    }
  }

  warn(message: any, context?: string, isTimestampEnabled?: boolean, ...args: any[]) {
    if (context) {
      if (typeof message === 'object') {
        this.logger.warn({[this.contextName]: context, ...message}, ...args);
      } else {
        this.logger.warn({[this.contextName]: context}, message, ...args);
      }
    } else {
      this.logger.warn(message, ...args);
    }
  }

  error(message: any, trace?: string, context?: string, isTimestampEnabled?: boolean, ...args: any[]) {
    if (context) {
      if (typeof message === 'object') {
        this.logger.error(
          { [this.contextName]: context, trace, ...message },
          ...args
        );
      } else {
        this.logger.error(
          { [this.contextName]: context, trace },
          message,
          ...args
        );
      }
    } else if (trace) {
      if (typeof message === 'object') {
        this.logger.error({trace, ...message}, ...args);
      } else {
        this.logger.error({trace}, message, ...args);
      }
    } else {
      this.logger.error(message, ...args);
    }
  }
}
