import * as pinoHttp from "pino-http";
import * as pino from "pino";
import { DestinationStream } from "pino";
import {
  ModuleMetadata,
  MiddlewareConfigProxy
} from "@nestjs/common/interfaces";

export type PassedLogger = { logger: pino.Logger };

/** Base configuration options for every SDK. */
export interface SentryOptions {
  /**
   * Enable debug functionality in the SDK itself
   */
  debug?: boolean;

  /**
   * Specifies whether this SDK should activate and send events to Sentry.
   * Disabling the SDK reduces all overhead from instrumentation, collecting
   * breadcrumbs and capturing events. Defaults to true.
   */
  enabled?: boolean;

  /**
   * The Dsn used to connect to Sentry and identify the project. If omitted, the
   * SDK will not send any data to Sentry.
   */
  dsn?: string;
  environment?: string;
}

export interface Params {
  pinoHttp?:
    | pinoHttp.Options
    | DestinationStream
    | [pinoHttp.Options, DestinationStream];
  name?: string;
  level?: string;
  exclude?: Parameters<MiddlewareConfigProxy["exclude"]>;
  forRoutes?: Parameters<MiddlewareConfigProxy["forRoutes"]>;
  useExisting?: true;
  renameContext?: string;
  sentry?: SentryOptions;
}

export interface LoggerModuleAsyncParams
  extends Pick<ModuleMetadata, "imports" | "providers"> {
  useFactory: (...args: any[]) => Params | Promise<Params>;
  inject?: any[];
}

export function isPassedLogger(
  pinoHttpProp: any
): pinoHttpProp is PassedLogger {
  return !!pinoHttpProp && "logger" in pinoHttpProp;
}
