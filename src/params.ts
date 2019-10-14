import * as pinoHttp from "pino-http";
import * as pino from "pino";
import { DestinationStream } from "pino";
import { ModuleMetadata } from "@nestjs/common/interfaces";

export type PassedLogger = { logger: pino.Logger };

export type Params =
  | null
  | pinoHttp.Options
  | DestinationStream
  | [pinoHttp.Options, DestinationStream];

export interface LoggerModuleAsyncOptions
  extends Pick<ModuleMetadata, "imports" | "providers"> {
  useFactory: (...args: any[]) => Params | Promise<Params>;
  inject?: any[];
}

export function isPassedLogger(
  params: PassedLogger | pino.LoggerOptions | pino.DestinationStream | null
): params is PassedLogger {
  return !!params && "logger" in params;
}
