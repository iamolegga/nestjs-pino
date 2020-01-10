import * as pinoHttp from "pino-http";
import * as pino from "pino";
import { DestinationStream } from "pino";
import {
  ModuleMetadata,
  MiddlewareConfigProxy
} from "@nestjs/common/interfaces";

export type PassedLogger = { logger: pino.Logger };

export interface Params {
  pinoHttp?:
    | pinoHttp.Options
    | DestinationStream
    | [pinoHttp.Options, DestinationStream];
  exclude?: Parameters<MiddlewareConfigProxy["exclude"]>;
  forRoutes?: Parameters<MiddlewareConfigProxy["forRoutes"]>;
  useExisting?: true;
  renameContext?: string;
  globalContext?: GlobalContext;
}

export interface GlobalContext {
  [key: string]: string | number | boolean | null;
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
