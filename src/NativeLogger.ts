/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, LoggerService, Inject } from '@nestjs/common';
import { Level } from 'pino';

import { Params, PARAMS_PROVIDER_TOKEN } from './params';
import { PinoLogger } from './PinoLogger';

@Injectable()
export class NativeLogger implements LoggerService {
  private readonly contextName: string;

  constructor(
    protected readonly logger: PinoLogger,
    @Inject(PARAMS_PROVIDER_TOKEN) { renameContext }: Params,
  ) {
    this.contextName = renameContext || 'context';
  }

  verbose(message: any, ...optionalParams: any[]) {
    this.call('trace', message, ...optionalParams);
  }

  debug(message: any, ...optionalParams: any[]) {
    this.call('debug', message, ...optionalParams);
  }

  log(message: any, ...optionalParams: any[]) {
    this.call('info', message, ...optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.call('warn', message, ...optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    this.callError(message, ...optionalParams);
  }

  fatal(message: any, ...optionalParams: any[]) {
    this.call('fatal', message, ...optionalParams);
  }

  private call(level: Level, message: any, ...optionalParams: any[]) {
    const args = [message, ...optionalParams];
    const { messages, context } = this.getContextAndMessagesToPrint(args);
    for (const msg of messages) {
      this.logSingleMessage(level, msg, context);
    }
  }

  private callError(message: any, ...optionalParams: any[]) {
    const args = [message, ...optionalParams];
    const { messages, context, stack } =
      this.getContextAndStackAndMessagesToPrint(args);
    for (const msg of messages) {
      this.logSingleMessage('error', msg, context, stack);
    }
  }

  private logSingleMessage(
    level: Level,
    message: unknown,
    context: string | undefined,
    stack?: string,
  ) {
    const objArg: Record<string, any> = {};

    if (context) {
      objArg[this.contextName] = context;
    }

    if (stack) {
      objArg.stack = stack;
    }

    if (typeof message === 'object' && message !== null) {
      if (message instanceof Error) {
        this.logger[level](objArg, message.stack || message.message);
      } else {
        this.logger[level](objArg, message as unknown as string);
      }
    } else {
      this.logger[level](objArg, String(message));
    }
  }

  private getContextAndMessagesToPrint(args: unknown[]): {
    messages: unknown[];
    context: string | undefined;
  } {
    if (args.length <= 1) {
      return { messages: args, context: undefined };
    }
    const lastElement = args[args.length - 1];
    if (typeof lastElement === 'string') {
      return {
        context: lastElement,
        messages: args.slice(0, args.length - 1),
      };
    }
    return { messages: args, context: undefined };
  }

  private getContextAndStackAndMessagesToPrint(args: unknown[]): {
    messages: unknown[];
    context: string | undefined;
    stack?: string;
  } {
    if (args.length === 2) {
      if (this.isStackFormat(args[1])) {
        return {
          messages: [args[0]],
          stack: args[1] as string,
          context: undefined,
        };
      }
      if (typeof args[1] === 'string') {
        return {
          messages: [args[0]],
          context: args[1],
        };
      }
    }

    const { messages, context } = this.getContextAndMessagesToPrint(args);
    if (messages.length <= 1) {
      return { messages, context };
    }

    const lastMessage = messages[messages.length - 1];
    if (typeof lastMessage === 'string' || typeof lastMessage === 'undefined') {
      return {
        stack: lastMessage,
        messages: messages.slice(0, messages.length - 1),
        context,
      };
    }
    return { messages, context };
  }

  private isStackFormat(value: unknown): boolean {
    if (typeof value !== 'string' && typeof value !== 'undefined') {
      return false;
    }
    return typeof value === 'string' && /^(.)+\n\s+at .+:\d+:\d+/.test(value);
  }
}
