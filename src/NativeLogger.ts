import {
  ConsoleLogger,
  Inject,
  Injectable,
  type LoggerService,
} from '@nestjs/common';
import { Level } from 'pino';
import { PinoLogger } from './PinoLogger';
import { PARAMS_PROVIDER_TOKEN, Params } from './params';

/**
 * NestJS v12 collects plain objects passed after the message into a single
 * `params` field instead of logging each of them as its own entry
 * (`ConsoleLoggerOptions.structuredParams`, on by default). NativeLogger exists
 * to match whichever `ConsoleLogger` the application actually has, so detect
 * the capability rather than the version: `stringifyParams` is the method v12
 * added for exactly this, and NestJS exposes no version at runtime.
 *
 * This only decides the *default*; the collecting itself is implemented here
 * and works on every supported NestJS version when asked for explicitly.
 */
const HAS_STRUCTURED_PARAMS = 'stringifyParams' in ConsoleLogger.prototype;

/** Mirrors `isPlainObject` from `@nestjs/common`, which is not public API. */
function isPlainObject(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value) as object | null;
  if (proto === null) {
    return true;
  }
  const ctor =
    Object.hasOwn(proto, 'constructor') &&
    (proto as { constructor: unknown }).constructor;
  return (
    typeof ctor === 'function' &&
    ctor instanceof ctor &&
    Function.prototype.toString.call(ctor) ===
      Function.prototype.toString.call(Object)
  );
}

@Injectable()
export class NativeLogger implements LoggerService {
  private readonly contextName: string;
  private readonly structuredParams: boolean;
  private readonly flattenParams: boolean;

  constructor(
    protected readonly logger: PinoLogger,
    @Inject(PARAMS_PROVIDER_TOKEN) { renameContext, nativeLogger }: Params,
  ) {
    this.contextName = renameContext || 'context';
    this.structuredParams =
      nativeLogger?.structuredParams ?? HAS_STRUCTURED_PARAMS;
    this.flattenParams = nativeLogger?.flattenParams ?? false;
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
    const { messages, context, params } =
      this.getContextAndMessagesToPrint(args);
    for (const msg of messages) {
      this.logSingleMessage(level, msg, context, undefined, params);
    }
  }

  private callError(message: any, ...optionalParams: any[]) {
    const args = [message, ...optionalParams];
    const { messages, context, stack, params } =
      this.getContextAndStackAndMessagesToPrint(args);
    for (const msg of messages) {
      this.logSingleMessage('error', msg, context, stack, params);
    }
  }

  private logSingleMessage(
    level: Level,
    message: unknown,
    context: string | undefined,
    stack?: string,
    params?: Record<string, any>,
  ) {
    // Flattened params go in first so that this logger's own fields win on a
    // key collision. Collisions with pino's fields (the level, the timestamp,
    // the message key, the base bindings) are not handled: pino does not
    // deduplicate keys either, and their names depend on the pino options, so
    // any guard here would be guesswork.
    const objArg: Record<string, any> =
      params && this.flattenParams ? { ...params } : {};

    if (context) {
      objArg[this.contextName] = context;
    }

    if (stack) {
      objArg.stack = stack;
    }

    if (params && !this.flattenParams) {
      objArg.params = params;
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
    params?: Record<string, any>;
  } {
    if (args.length <= 1) {
      return { messages: args, context: undefined };
    }
    const lastElement = args[args.length - 1];
    const isContext = typeof lastElement === 'string';
    const context = isContext ? lastElement : undefined;
    const remainingArgs = isContext ? args.slice(0, args.length - 1) : args;

    if (!this.structuredParams) {
      return { messages: remainingArgs, context };
    }

    // The first argument is always the message; only plain objects after it
    // become params, everything else stays a message of its own.
    const messages: unknown[] = [remainingArgs[0]];
    const paramObjects: Record<string, any>[] = [];
    for (const arg of remainingArgs.slice(1)) {
      if (isPlainObject(arg)) {
        paramObjects.push(arg as Record<string, any>);
      } else {
        messages.push(arg);
      }
    }

    return {
      messages,
      context,
      params: paramObjects.length
        ? Object.assign({}, ...paramObjects)
        : undefined,
    };
  }

  private getContextAndStackAndMessagesToPrint(args: unknown[]): {
    messages: unknown[];
    context: string | undefined;
    stack?: string;
    params?: Record<string, any>;
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

    const trailingArg = args[args.length - 1];
    if (args.length > 2 && this.isStackFormat(trailingArg)) {
      const { messages, context, params } = this.getContextAndMessagesToPrint(
        args.slice(0, -1),
      );
      return { messages, context, stack: trailingArg as string, params };
    }

    const { messages, context, params } =
      this.getContextAndMessagesToPrint(args);
    if (messages.length <= 1) {
      return { messages, context, params };
    }

    const lastMessage = messages[messages.length - 1];
    if (typeof lastMessage === 'string' || typeof lastMessage === 'undefined') {
      return {
        stack: lastMessage,
        messages: messages.slice(0, messages.length - 1),
        context,
        params,
      };
    }
    return { messages, context, params };
  }

  private isStackFormat(value: unknown): boolean {
    if (typeof value !== 'string' && typeof value !== 'undefined') {
      return false;
    }
    return typeof value === 'string' && /^(.)+\n\s+at .+:\d+:\d+/.test(value);
  }
}
