/* eslint-disable @typescript-eslint/ban-types */
import { Injectable, Inject, Scope } from '@nestjs/common';
import * as pino from 'pino';
import { Params, isPassedLogger, PARAMS_PROVIDER_TOKEN } from './params';
import { storage } from './storage';

type PinoMethods = Pick<
  pino.BaseLogger,
  'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
>;
type LogMsg = [msg: string, ...args: any[]];
type LogObj = [obj: Record<string, any>, msg?: string, ...args: any[]];

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

  trace(...args: LogMsg): void;
  trace(...args: LogObj): void;
  trace(...args: LogMsg | LogObj) {
    this.call('trace', ...args);
  }

  debug(...args: LogMsg): void;
  debug(...args: LogObj): void;
  debug(...args: LogMsg | LogObj) {
    this.call('debug', ...args);
  }

  info(...args: LogMsg): void;
  info(...args: LogObj): void;
  info(...args: LogMsg | LogObj) {
    this.call('info', ...args);
  }

  warn(...args: LogMsg): void;
  warn(...args: LogObj): void;
  warn(...args: LogMsg | LogObj) {
    this.call('warn', ...args);
  }

  error(...args: LogMsg): void;
  error(...args: LogObj): void;
  error(...args: LogMsg | LogObj) {
    this.call('error', ...args);
  }

  fatal(...args: LogMsg): void;
  fatal(...args: LogObj): void;
  fatal(...args: LogMsg | LogObj) {
    this.call('fatal', ...args);
  }

  setContext(value: string) {
    this.context = value;
  }

  private call(method: pino.Level, ...args: LogMsg | LogObj) {
    if (this.context) {
      if (isLogObj(args)) {
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

function isLogObj(args: LogMsg | LogObj): args is LogObj {
  return typeof args[0] === 'object';
}
