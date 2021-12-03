/* eslint-disable @typescript-eslint/ban-types */
import { Injectable, Inject, Scope } from '@nestjs/common';
import pino from 'pino';
import { Params, isPassedLogger, PARAMS_PROVIDER_TOKEN } from './params';
import { storage } from './storage';

type PinoMethods = Pick<
  pino.Logger,
  'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
>;

/**
 * This is copy of pino.LogFn but with possibilty to make method override.
 * Current usage works:
 *
 *  trace(msg: string, ...args: any[]): void;
 *  trace(obj: object, msg?: string, ...args: any[]): void;
 *  trace(...args: Parameters<LoggerFn>) {
 *    this.call('trace', ...args);
 *  }
 *
 * But if change local LoggerFn to pino.LogFn – this will say that overrides
 * are incompatible
 */
type LoggerFn =
  | ((msg: string, ...args: any[]) => void)
  | ((obj: object, msg?: string, ...args: any[]) => void);

let outOfContext: pino.Logger | undefined;

export function __resetOutOfContextForTests() {
  outOfContext = undefined;
  // @ts-ignore reset root for tests only
  PinoLogger.root = undefined;
}

@Injectable({ scope: Scope.TRANSIENT })
export class PinoLogger implements PinoMethods {
  /**
   * root is the most root logger that can be used to change params at runtime.
   * Accessible only when `useExisting` is not set to `true` in `Params`.
   * Readonly, but you can change it's properties.
   */
  static readonly root: pino.Logger;

  private context = '';
  private readonly contextName: string;

  constructor(
    @Inject(PARAMS_PROVIDER_TOKEN) { pinoHttp, renameContext }: Params,
  ) {
    if (!outOfContext) {
      if (Array.isArray(pinoHttp)) {
        outOfContext = pino(...pinoHttp);
      } else if (isPassedLogger(pinoHttp)) {
        outOfContext = pinoHttp.logger;
      } else if (
        typeof pinoHttp === 'object' &&
        'stream' in pinoHttp &&
        typeof pinoHttp.stream !== 'undefined'
      ) {
        outOfContext = pino(pinoHttp, pinoHttp.stream);
      } else {
        outOfContext = pino(pinoHttp);
      }
    }

    this.contextName = renameContext || 'context';
  }

  trace(msg: string, ...args: any[]): void;
  trace(obj: unknown, msg?: string, ...args: any[]): void;
  trace(...args: Parameters<LoggerFn>) {
    this.call('trace', ...args);
  }

  debug(msg: string, ...args: any[]): void;
  debug(obj: unknown, msg?: string, ...args: any[]): void;
  debug(...args: Parameters<LoggerFn>) {
    this.call('debug', ...args);
  }

  info(msg: string, ...args: any[]): void;
  info(obj: unknown, msg?: string, ...args: any[]): void;
  info(...args: Parameters<LoggerFn>) {
    this.call('info', ...args);
  }

  warn(msg: string, ...args: any[]): void;
  warn(obj: unknown, msg?: string, ...args: any[]): void;
  warn(...args: Parameters<LoggerFn>) {
    this.call('warn', ...args);
  }

  error(msg: string, ...args: any[]): void;
  error(obj: unknown, msg?: string, ...args: any[]): void;
  error(...args: Parameters<LoggerFn>) {
    this.call('error', ...args);
  }

  fatal(msg: string, ...args: any[]): void;
  fatal(obj: unknown, msg?: string, ...args: any[]): void;
  fatal(...args: Parameters<LoggerFn>) {
    this.call('fatal', ...args);
  }

  setContext(value: string) {
    this.context = value;
  }

  private call(method: pino.Level, ...args: Parameters<LoggerFn>) {
    if (this.context) {
      if (isFirstArgObject(args)) {
        const firstArg = args[0];
        if (firstArg instanceof Error) {
          args = [
            Object.assign(
              { [this.contextName]: this.context },
              { err: firstArg },
            ),
            ...args.slice(1),
          ];
        } else {
          args = [
            Object.assign({ [this.contextName]: this.context }, firstArg),
            ...args.slice(1),
          ];
        }
      } else {
        args = [{ [this.contextName]: this.context }, ...args];
      }
    }
    // @ts-ignore args are union of tuple types
    this.logger[method](...args);
  }

  public get logger(): pino.Logger {
    // outOfContext is always set in runtime before starts using
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return storage.getStore()?.logger || outOfContext!;
  }

  public assign(fields: pino.Bindings) {
    const store = storage.getStore();
    if (!store) {
      throw new Error(
        `${PinoLogger.name}: unable to assign extra fields out of request scope`,
      );
    }
    store.logger = store.logger.child(fields);
  }
}

function isFirstArgObject(
  args: Parameters<LoggerFn>,
): args is [obj: object, msg?: string, ...args: any[]] {
  return typeof args[0] === 'object';
}
