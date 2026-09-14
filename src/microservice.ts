import { ExecutionContext, Logger as NestLogger } from '@nestjs/common';
import { LevelWithSilent, Logger } from 'pino';
import { Observable, Subscription } from 'rxjs';

import { MicroserviceParams, Params } from './params';
import { getRootLogger } from './rootLogger';
import { getRpcInfo, RpcInfo } from './rpc';
import { Store, storage } from './storage';

/**
 * Structurally identical to `PreRequestHook` from `@nestjs/common`, which only
 * exists in NestJS 12. Declared here rather than imported so that type checking
 * still passes against the NestJS 11 the package also supports.
 */
export type PreRequestHook = (
  context: ExecutionContext,
  next: () => Observable<unknown>,
) => Observable<unknown>;

/**
 * Injection token of the pre-request hook that does the microservice logging.
 *
 * Prefer {@link registerMicroserviceLogging}, which registers this and
 * everything else the hook needs. This token is the low-level way in, for an
 * application that wires its microservice up by hand.
 */
export const PINO_PRE_REQUEST_HOOK = 'pino-pre-request-hook';

/**
 * The subset of `ApplicationConfig` this needs, as of NestJS 12.
 *
 * NestJS 12.0.0 and 12.0.1 are deliberately kept out of the peer range: with a
 * pre-request hook registered they flattened a handler's plain return value —
 * a string replied one character at a time, a number failed outright. Fixed in
 * 12.0.2 by https://github.com/nestjs/nest/pull/17644.
 */
interface PreRequestHookRegistry {
  registerPreRequestHook?: (...hooks: PreRequestHook[]) => void;
  getGlobalPreRequestHooks?: () => PreRequestHook[];
}

type HookParams = Pick<
  Params<any, any, any>,
  'microservice' | 'assignResponse'
>;

// One hook per set of parameters, so that the automatically registered hook and
// the one behind `PINO_PRE_REQUEST_HOOK` are the same function. Registering the
// same hook twice would log every message twice.
const hooks = new WeakMap<object, PreRequestHook>();

export function getMicroserviceHook(params: HookParams): PreRequestHook {
  let hook = hooks.get(params);
  if (!hook) {
    hook = createMicroserviceHook(params);
    hooks.set(params, hook);
  }
  return hook;
}

/**
 * Registers the hook on the `ApplicationConfig` the microservice will read it
 * from. Returns whether the running NestJS supports pre-request hooks at all.
 */
export function registerMicroserviceHook(
  applicationConfig: unknown,
  params: HookParams,
): boolean {
  const registry = applicationConfig as PreRequestHookRegistry;

  if (typeof registry.registerPreRequestHook !== 'function') {
    warnNoPreRequestHooks();
    return false;
  }

  const hook = getMicroserviceHook(params);
  if (registry.getGlobalPreRequestHooks?.().includes(hook)) {
    return true;
  }

  registry.registerPreRequestHook(hook);
  return true;
}

function warnNoPreRequestHooks() {
  new NestLogger('LoggerModule').warn(
    'Microservice logging needs the pre-request hooks introduced in NestJS ' +
      '12, so microservice messages will be logged without a logging ' +
      'context. Everything else is unaffected.',
  );
}

/** The subset of `INestMicroservice` {@link registerMicroserviceLogging} needs. */
interface MicroserviceApp {
  get(token: unknown, options?: unknown): unknown;
  /** Optional so that a call still type checks against NestJS 11. */
  registerPreRequestHook?(...hooks: PreRequestHook[]): unknown;
}

/**
 * Sets up microservice logging on a microservice NestJS could not hand the hook
 * to by itself — a hybrid application connected without
 * `{ inheritAppConfig: true }`, which gets an `ApplicationConfig` of its own
 * that dependency injection cannot reach:
 *
 * ```ts
 * const ms = app.connectMicroservice(options, { deferInitialization: true });
 * registerMicroserviceLogging(ms);
 * ```
 *
 * Must be called before the microservice starts listening, and the module still
 * needs `microservice` in its parameters for the options to apply. On NestJS 11
 * this warns and does nothing, like the parameter itself.
 */
export function registerMicroserviceLogging(app: MicroserviceApp): void {
  if (typeof app.registerPreRequestHook !== 'function') {
    warnNoPreRequestHooks();
    return;
  }
  app.registerPreRequestHook(app.get(PINO_PRE_REQUEST_HOOK) as PreRequestHook);
}

function defaultGenReqId() {
  let id = 0;
  return () => ++id;
}

function createMicroserviceHook(params: HookParams): PreRequestHook {
  const options: MicroserviceParams<any> =
    typeof params.microservice === 'object' ? params.microservice : {};

  if (options.useLevel && options.customLogLevel) {
    throw new Error(
      "You can't pass 'useLevel' and 'customLogLevel' together in `microservice`",
    );
  }

  const keys = options.customAttributeKeys ?? {};
  const rpcKey = keys.rpc ?? 'rpc';
  const errKey = keys.err ?? 'err';
  const reqIdKey = keys.reqId ?? 'reqId';
  const responseTimeKey = keys.responseTime ?? 'responseTime';

  const useLevel = options.useLevel ?? 'info';
  const customLogLevel = options.customLogLevel;
  const autoLogging = options.autoLogging !== false;
  const ignore =
    typeof options.autoLogging === 'object'
      ? options.autoLogging.ignore
      : undefined;
  const genReqId = options.genReqId ?? defaultGenReqId();
  const assignResponse = !!params.assignResponse;
  const {
    customProps,
    customReceivedMessage,
    customReceivedObject,
    customSuccessMessage,
    customSuccessObject,
    customErrorMessage,
    customErrorObject,
    includePayload,
    quietRpcLogger,
    quietResLogger,
  } = options;

  const logsOnArrival = !!customReceivedMessage || !!customReceivedObject;

  function levelFor(
    context: ExecutionContext,
    error: Error | undefined,
  ): LevelWithSilent {
    if (customLogLevel) {
      return customLogLevel(context, error) as LevelWithSilent;
    }
    // `pino-http` logs a failed request at `useLevel` too; errors here default
    // to `error` instead, because `useLevel` is routinely lowered to quiet down
    // chatty events and that must not also hide failures. The hook sees the
    // error before any `@Catch()` filter, so an `RpcException` thrown on
    // purpose reaches this as well — `customLogLevel` is the way out.
    return error ? 'error' : (useLevel as LevelWithSilent);
  }

  function buildRecord(context: ExecutionContext, info: RpcInfo) {
    const record: Record<string, unknown> = {
      type: info.type,
      pattern: info.pattern,
      transport: info.transport,
      controller: info.controller,
      handler: info.handler,
    };
    if (includePayload) {
      record.payload = context.switchToRpc().getData();
    }
    return record;
  }

  return (context, next) =>
    new Observable<unknown>((subscriber) => {
      const base = getRootLogger();
      // Only reachable if the hook runs before any `PinoLogger` was built,
      // which the module's own ordering rules out. Log nothing rather than
      // break the message.
      if (!base) {
        return next().subscribe(subscriber);
      }

      const info = getRpcInfo(context);
      const quiet = base.child({ [reqIdKey]: genReqId(context) });

      let full: Logger = quiet.child({
        [rpcKey]: buildRecord(context, info),
      });
      const props = customProps?.(context);
      if (props) {
        full = full.child(props);
      }

      const contextLogger = quietRpcLogger ? quiet : full;
      const closingLogger = quietResLogger ? quiet : full;
      const skip = !autoLogging || (ignore?.(context) ?? false);
      const start = Date.now();
      let result: unknown;

      function logCompleted() {
        const level = levelFor(context, undefined);
        if (level === 'silent') return;

        const responseTime = Date.now() - start;
        const value = { [responseTimeKey]: responseTime };
        closingLogger[level](
          customSuccessObject?.(context, result, value) ?? value,
          customSuccessMessage?.(context, result, responseTime) ??
            `${info.type} completed`,
        );
      }

      function logErrored(error: Error) {
        const level = levelFor(context, error);
        if (level === 'silent') return;

        const responseTime = Date.now() - start;
        const value = {
          [errKey]: error,
          [responseTimeKey]: responseTime,
        };
        closingLogger[level](
          customErrorObject?.(context, error, value) ?? value,
          customErrorMessage?.(context, error, responseTime) ??
            `${info.type} errored`,
        );
      }

      // `assign` replaces the store's logger with a child of it, so the log
      // that closes the message keeps the fields it started with — unless
      // `assignResponse` asks for the opposite, exactly as over HTTP.
      const store = new Store(
        contextLogger,
        assignResponse ? closingLogger : undefined,
      );

      let subscription: Subscription | undefined;

      // Subscribing inside `run` is what puts the whole downstream pipeline —
      // guards, interceptors, pipes and the handler — inside the context.
      storage.run(store, () => {
        if (!skip && logsOnArrival) {
          const level = levelFor(context, undefined);
          if (level !== 'silent') {
            contextLogger[level](
              customReceivedObject?.(context) ?? {},
              customReceivedMessage?.(context),
            );
          }
        }

        subscription = next().subscribe({
          next: (value) => {
            result = value;
            subscriber.next(value);
          },
          error: (error) => {
            if (!skip) logErrored(error as Error);
            subscriber.error(error);
          },
          complete: () => {
            if (!skip) logCompleted();
            subscriber.complete();
          },
        });
      });

      return () => subscription?.unsubscribe();
    });
}
