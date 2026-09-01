import { Inject, Injectable, Scope } from '@nestjs/common';
import pino from 'pino';

import { PARAMS_PROVIDER_TOKEN, Params } from './params';
import { ensureRootLogger, getRootLogger, resetRootLogger } from './rootLogger';
import { Store, storage } from './storage';

type PinoMethods<CustomLevels extends string = never> = Pick<
  pino.Logger<CustomLevels>,
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

export function __resetOutOfContextForTests() {
  resetRootLogger();
  // @ts-expect-error reset root for tests only
  PinoLogger.root = undefined;
}

/**
 * Options of {@link PinoLogger.runInContext}.
 */
export interface RunInContextOptions {
  /**
   * Fields to bind to every log made inside the context, the way `pino-http`
   * binds the request to a request logger.
   */
  bindings?: pino.Bindings;

  /**
   * Start from the logger of the surrounding context, when there is one,
   * instead of from the root logger. The store itself is always a new one, so
   * `assign` inside never leaks back out.
   * @default false
   */
  inherit?: boolean;
}

/**
 * @typeParam CustomLevels - union of the `customLevels` keys passed to pino, so
 * that `logger` exposes them. The class itself is instantiated by the DI
 * container, which cannot infer a type argument, so custom levels are reachable
 * as `pinoLogger.logger.myLevel(...)` rather than `pinoLogger.myLevel(...)`.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class PinoLogger<CustomLevels extends string = never>
  implements PinoMethods<CustomLevels>
{
  /**
   * root is the most root logger that can be used to change params at runtime.
   * Accessible only when `useExisting` is not set to `true` in `Params`.
   * Readonly, but you can change it's properties.
   */
  static readonly root: pino.Logger;

  protected context = '';
  protected readonly contextName: string;
  protected readonly errorKey: string = 'err';

  constructor(
    @Inject(PARAMS_PROVIDER_TOKEN)
    { pinoHttp, renameContext, useExisting }: Params<any, any, CustomLevels>,
  ) {
    // Handle both array tuple [Options, DestinationStream] and object forms
    const pinoHttpOptions = Array.isArray(pinoHttp) ? pinoHttp[0] : pinoHttp;
    if (
      typeof pinoHttpOptions === 'object' &&
      'customAttributeKeys' in pinoHttpOptions &&
      typeof pinoHttpOptions.customAttributeKeys !== 'undefined'
    ) {
      this.errorKey = pinoHttpOptions.customAttributeKeys.err ?? 'err';
    }

    const root = ensureRootLogger(pinoHttp);

    // With `useExisting` the logger belongs to the Fastify adapter, so there is
    // no root of ours to expose and the documented `undefined` stands. The root
    // logger itself is still built, because logs made outside of a request have
    // nowhere else to go.
    if (!useExisting) {
      // @ts-expect-error root is a readonly field, this is where it is set
      PinoLogger.root = root;
    }

    this.contextName = renameContext || 'context';
  }

  get logger(): pino.Logger<CustomLevels> {
    // outOfContext is always set in runtime before starts using.
    //
    // The cast goes through `unknown` because `pino-http` augments
    // `http.IncomingMessage` with a plain, non-generic `pino.Logger`, so `Store`
    // cannot carry the custom levels through, and `pino.Logger`'s `onChild`
    // makes the two instantiations mutually non-comparable.
    return (storage.getStore()?.logger ||
      getRootLogger()!) as unknown as pino.Logger<CustomLevels>;
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

  assign(fields: pino.Bindings) {
    const store = storage.getStore();
    if (!store) {
      throw new Error(
        `${PinoLogger.name}: unable to assign extra fields out of request scope`,
      );
    }
    store.logger = store.logger.child(fields);
    store.responseLogger?.setBindings(fields);
  }

  /**
   * Runs `fn` inside a fresh logging context, so that `assign` works and every
   * log made within it carries `bindings` — the same thing the HTTP middleware
   * does per request, for the places NestJS has no request pipeline for: queue
   * processors, cron jobs, CLI commands, standalone scripts, tests, and
   * consumers wired up outside of Nest.
   *
   * Returns whatever `fn` returns; an async `fn` keeps the context across every
   * `await` inside it.
   */
  runInContext<T>(fn: () => T, options: RunInContextOptions = {}): T {
    const { bindings, inherit = false } = options;
    const current = storage.getStore();
    const base = (inherit && current ? current.logger : getRootLogger()!)!;
    const logger = bindings ? base.child(bindings) : base;

    // The response logger is deliberately not carried over when inheriting:
    // fields assigned inside the nested context must not reach the log that
    // closes the surrounding request.
    return storage.run(new Store(logger), fn);
  }

  protected call(
    method: pino.Level | CustomLevels,
    ...args: Parameters<LoggerFn>
  ) {
    if (this.context) {
      if (isFirstArgObject(args)) {
        const firstArg = args[0];
        if (firstArg instanceof Error) {
          args = [
            Object.assign(
              { [this.contextName]: this.context },
              { [this.errorKey]: firstArg },
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
    // @ts-expect-error args are union of tuple types
    this.logger[method](...args);
  }
}

function isFirstArgObject(
  args: Parameters<LoggerFn>,
): args is [obj: object, msg?: string, ...args: any[]] {
  return typeof args[0] === 'object';
}
