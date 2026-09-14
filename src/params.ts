import { IncomingMessage, ServerResponse } from 'node:http';

import {
  ExecutionContext,
  FactoryProvider,
  MiddlewareConsumer,
  ModuleMetadata,
} from '@nestjs/common';
import { DestinationStream, LevelWithSilent, Logger } from 'pino';
import { Options, ReqId } from 'pino-http';

// The `@nestjs/common/interfaces` subpath stopped resolving in v12, where the
// package is ESM and its exports map turns `./interfaces` into a missing
// `interfaces.js`. `MiddlewareConfigProxy` is not re-exported from the root
// either, so derive it from `MiddlewareConsumer`.
export type MiddlewareConfigProxy = ReturnType<MiddlewareConsumer['apply']>;

export type PassedLogger<CustomLevels extends string = never> = {
  logger: Logger<CustomLevels>;
};

/**
 * The type parameters are all optional and default to what `pino-http` itself
 * defaults to, so `Params` keeps working unparameterised.
 *
 * @typeParam IM - request type, e.g. express' `Request`
 * @typeParam SR - response type, e.g. express' `Response`
 * @typeParam CustomLevels - union of the `customLevels` keys, if any
 */
export interface Params<
  IM = IncomingMessage,
  SR = ServerResponse,
  CustomLevels extends string = never,
> {
  /**
   * Optional parameters for `pino-http` module
   * @see https://github.com/pinojs/pino-http#pinohttpopts-stream
   */
  pinoHttp?:
    | Options<IM, SR, CustomLevels>
    | DestinationStream
    | [Options<IM, SR, CustomLevels>, DestinationStream];

  /**
   * Optional parameter for routing. It should implement interface of
   * parameters of NestJS built-in `MiddlewareConfigProxy['forRoutes']`.
   * @see https://docs.nestjs.com/middleware#applying-middleware
   * It can be used for both disabling automatic req/res logs and
   * removing request context from following logs. It works for all requests by
   * default. If you only need to turn off the automatic request/response
   * logging for some specific (or all) routes but keep request context for app
   * logs use `pinoHttp.autoLogging` field.
   */
  exclude?: Parameters<MiddlewareConfigProxy['exclude']>;

  /**
   * Optional parameter for routing. It should implement interface of
   * parameters of NestJS built-in `MiddlewareConfigProxy['forRoutes']`.
   * @see https://docs.nestjs.com/middleware#applying-middleware
   * It can be used for both disabling automatic req/res logs and
   * removing request context from following logs. It works for all requests by
   * default. If you only need to turn off the automatic request/response
   * logging for some specific (or all) routes but keep request context for app
   * logs use `pinoHttp.autoLogging` field.
   */
  forRoutes?: Parameters<MiddlewareConfigProxy['forRoutes']>;

  /**
   * Optional parameter to skip pino configuration in case you are using
   * FastifyAdapter, and already configure logger in adapter's config. The Pros
   * and cons of this approach are described in the FAQ section of the
   * documentation:
   * @see https://github.com/iamolegga/nestjs-pino#faq.
   */
  useExisting?: true;

  /**
   * Optional parameter to change property name `context` in resulted logs,
   * so logs will be like:
   * {"level":30, ... "RENAME_CONTEXT_VALUE_HERE":"AppController" }
   */
  renameContext?: string;

  /**
   * Optional parameter to also assign the response logger during calls to
   * `PinoLogger.assign`. By default, `assign` does not impact response logs
   * (e.g.`Request completed`).
   */
  assignResponse?: boolean;

  /**
   * Optional parameters for `NativeLogger`, mirroring the `ConsoleLogger`
   * options of the same name so that an application can move over keeping its
   * existing configuration. Unlike NestJS, both are honoured on every supported
   * NestJS version; only the default of `structuredParams` follows the
   * `ConsoleLogger` that is actually installed.
   */
  nativeLogger?: {
    /**
     * If enabled, plain objects logged after the message are attached to the
     * same entry as `params` instead of being logged as separate entries.
     * @default true on NestJS 12+, false before that
     */
    structuredParams?: boolean;

    /**
     * If enabled, params are spread into the root of the record instead of
     * nested under `params`. Keys already used by the log record itself are
     * never overwritten.
     * @default false
     */
    flattenParams?: boolean;
  };

  /**
   * Enables `pino-http`-like automatic logging and, more importantly, a logging
   * context for microservice message handlers, so that `PinoLogger.assign` and
   * inherited fields work there the way they do in an HTTP request. Pass `true`
   * for the defaults.
   *
   * Implemented on the NestJS 12 microservices pre-request hooks, which the
   * module registers by itself; 12.0.2 or later, because earlier 12.0.x
   * releases mangled a handler's plain return value once a hook was present.
   * Two caveats follow from how NestJS wires them: on NestJS 11 the API does
   * not exist and this is ignored with a warning, and a hybrid application has
   * to be connected with `{ inheritAppConfig: true }` for the hook to reach its
   * microservice.
   * @see https://docs.nestjs.com/microservices/pre-request-hooks
   */
  microservice?: boolean | MicroserviceParams<CustomLevels>;
}

/**
 * Options for automatic logging of microservice messages, deliberately shaped
 * after `pino-http`'s: every parameter that does not need the request or the
 * response keeps its name and meaning, and the ones that do take an
 * `ExecutionContext` instead. Use {@link getRpcInfo} inside them to reach the
 * pattern, the transport and whether the handler is a `@MessagePattern` or an
 * `@EventPattern`.
 *
 * Everything pino itself is configured with — level, transport, redact,
 * serializers, formatters — stays in `pinoHttp`, which builds the one logger
 * both halves of the application share.
 *
 * @see https://github.com/pinojs/pino-http#pinohttpopts-stream
 */
export interface MicroserviceParams<CustomLevels extends string = never> {
  /**
   * Set to `false` to stop logging a line per message. The logging *context*
   * is still established either way, so `PinoLogger.assign` and the inherited
   * fields keep working.
   * @default true
   */
  autoLogging?:
    | boolean
    | {
        /** Skip the automatic logs for the messages this returns `true` for. */
        ignore?: (context: ExecutionContext) => boolean;
      };

  /**
   * Level of the `received` and `completed` logs. Errors default to `error`
   * regardless of this — unlike `pino-http`, where a failed request is logged
   * at `useLevel` too — so that lowering this to quiet down events does not
   * also hide failures. Use `customLogLevel` to change the error level.
   * Cannot be combined with `customLogLevel`.
   * @default 'info'
   */
  useLevel?: LevelWithSilent | CustomLevels;

  /**
   * Decides the level of every automatic log, including the error one. Note
   * that the hook runs before any `@Catch()` filter, so `error` is set for
   * exceptions the application goes on to handle itself, an `RpcException`
   * thrown on purpose included.
   */
  customLogLevel?: (
    context: ExecutionContext,
    error?: Error,
  ) => LevelWithSilent | CustomLevels;

  /**
   * Generates the value bound as `reqId`. Defaults to an incrementing counter,
   * as in `pino-http`; a correlation id off the transport context is usually a
   * better choice.
   */
  genReqId?: (context: ExecutionContext) => ReqId;

  /**
   * Setting this — or `customReceivedObject` — is what enables the log on
   * arrival. There is no default text, so nothing is logged on arrival unless
   * asked for, exactly as in `pino-http`.
   */
  customReceivedMessage?: (context: ExecutionContext) => string;

  /** @default `'message completed'`, or `'event completed'` for an `@EventPattern` */
  customSuccessMessage?: (
    context: ExecutionContext,
    result: unknown,
    responseTime: number,
  ) => string;

  /** @default `'message errored'`, or `'event errored'` for an `@EventPattern` */
  customErrorMessage?: (
    context: ExecutionContext,
    error: Error,
    responseTime: number,
  ) => string;

  /**
   * Fields of the log on arrival, which it enables the same way
   * `customReceivedMessage` does. There is no default object, so what it
   * returns is logged as is.
   */
  customReceivedObject?: (context: ExecutionContext) => object;

  /**
   * Replaces the fields of the `completed` log. `value` is what would be logged
   * otherwise — `responseTime` under its configured key — and is not merged
   * back in, so spread it if the extra fields should come on top.
   */
  customSuccessObject?: (
    context: ExecutionContext,
    result: unknown,
    value: object,
  ) => object;

  /**
   * Replaces the fields of the `errored` log. `value` holds `err` and
   * `responseTime` under their configured keys and, as with
   * `customSuccessObject`, is not merged back in.
   */
  customErrorObject?: (
    context: ExecutionContext,
    error: Error,
    value: object,
  ) => object;

  /** Extra fields bound to every log made while handling the message. */
  customProps?: (context: ExecutionContext) => object;

  /**
   * Renames the keys this adds to the log record. The `rpc` key is the
   * microservice counterpart of `pino-http`'s `req`/`res`.
   */
  customAttributeKeys?: {
    /** @default 'rpc' */
    rpc?: string;
    /** @default 'err' */
    err?: string;
    /** @default 'reqId' */
    reqId?: string;
    /** @default 'responseTime' */
    responseTime?: string;
  };

  /**
   * Bind only `reqId`, leaving the `rpc` object out of the logs made while
   * handling the message. Mirrors `pino-http`'s `quietReqLogger`.
   */
  quietRpcLogger?: boolean;

  /**
   * Leave the `rpc` object out of the `completed`/`errored` log, which repeats
   * what the surrounding logs already carry. Mirrors `quietResLogger`.
   */
  quietResLogger?: boolean;

  /**
   * Log the message payload as `rpc.payload`. Off by default: payloads are
   * unbounded in size and routinely carry personal data. `redact` and a
   * `serializers.rpc` entry in `pinoHttp` apply to it as to anything else.
   * @default false
   */
  includePayload?: boolean;
}

export interface LoggerModuleAsyncParams<
  IM = IncomingMessage,
  SR = ServerResponse,
  CustomLevels extends string = never,
> extends Pick<ModuleMetadata, 'imports' | 'providers'>,
    // `provide` is deliberately not picked: `forRootAsync` sets it to
    // `PARAMS_PROVIDER_TOKEN` itself, so a caller-supplied token would only be
    // overwritten.
    Pick<
      FactoryProvider<Params<IM, SR, CustomLevels>>,
      'useFactory' | 'inject'
    > {}

export function isPassedLogger(
  pinoHttpProp: any,
): pinoHttpProp is PassedLogger {
  return !!pinoHttpProp && 'logger' in pinoHttpProp;
}

export const PARAMS_PROVIDER_TOKEN = 'pino-params';
