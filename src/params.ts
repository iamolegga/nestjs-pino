import { Options } from 'pino-http';
import { Logger, DestinationStream } from 'pino';
import {
  MiddlewareConfigProxy,
  ModuleMetadata,
} from '@nestjs/common/interfaces';

export type PassedLogger = { logger: Logger };

export interface Params {
  /**
   * Optional parameters for `pino-http` module
   * @see https://github.com/pinojs/pino-http#pinohttpopts-stream
   */
  pinoHttp?: Options | DestinationStream | [Options, DestinationStream];

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
}

export interface LoggerModuleAsyncParams
  extends Pick<ModuleMetadata, 'imports' | 'providers'> {
  useFactory: (...args: any[]) => Params | Promise<Params>;
  inject?: any[];
}

export function isPassedLogger(
  pinoHttpProp: any,
): pinoHttpProp is PassedLogger {
  return !!pinoHttpProp && 'logger' in pinoHttpProp;
}

export const PARAMS_PROVIDER_TOKEN = 'pino-params';
