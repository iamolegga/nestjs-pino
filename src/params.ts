import { IncomingMessage, ServerResponse } from 'node:http';

import {
  FactoryProvider,
  MiddlewareConsumer,
  ModuleMetadata,
} from '@nestjs/common';
import { DestinationStream, Logger } from 'pino';
import { Options } from 'pino-http';

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
