import { Injectable, LoggerService } from "@nestjs/common";
import express from "express";
import expressPinoMiddleware from "express-pino-logger";
import pino, { LoggerOptions, DestinationStream } from "pino";
import { getValue, setValue, middleware as ctxMiddleware } from "express-ctx";

let outOfContextLogger: pino.Logger;

const loggerKey = "logger";

@Injectable()
export class Logger implements LoggerService {
  verbose(msg: string, ...args: any[]): void;
  verbose(obj: object, msg?: string, ...args: any[]): void;
  verbose(...params: [any, ...any[]]) {
    return (getValue<pino.Logger>(loggerKey) || outOfContextLogger).trace(
      ...params
    );
  }
  debug(msg: string, ...args: any[]): void;
  debug(obj: object, msg?: string, ...args: any[]): void;
  debug(...params: [any, ...any[]]) {
    return (getValue<pino.Logger>(loggerKey) || outOfContextLogger).debug(
      ...params
    );
  }
  log(msg: string, ...args: any[]): void;
  log(obj: object, msg?: string, ...args: any[]): void;
  log(...params: [any, ...any[]]) {
    return (getValue<pino.Logger>(loggerKey) || outOfContextLogger).info(
      ...params
    );
  }

  warn(msg: string, ...args: any[]): void;
  warn(obj: object, msg?: string, ...args: any[]): void;
  warn(...params: [any, ...any[]]) {
    return (getValue<pino.Logger>(loggerKey) || outOfContextLogger).warn(
      ...params
    );
  }

  error(msg: string, ...args: any[]): void;
  error(obj: object, msg?: string, ...args: any[]): void;
  error(...params: [any, ...any[]]) {
    return (getValue<pino.Logger>(loggerKey) || outOfContextLogger).error(
      ...params
    );
  }
}

type PassedLogger = { logger: pino.Logger };

type Params =
  | []
  | [PassedLogger]
  | [LoggerOptions | DestinationStream]
  | [LoggerOptions, DestinationStream];

export function createLoggerMiddlewares(): express.Handler[];

export function createLoggerMiddlewares(
  options: PassedLogger
): express.Handler[];

export function createLoggerMiddlewares(
  optionsOrStream: LoggerOptions | DestinationStream
): express.Handler[];

export function createLoggerMiddlewares(
  options: LoggerOptions,
  stream: DestinationStream
): express.Handler[];

export function createLoggerMiddlewares(...params: Params) {
  if (hasLoggerParamsPassedLogger(params)) {
    outOfContextLogger = params[0].logger;
  } else {
    outOfContextLogger = pino(...params);
  }

  return [
    ctxMiddleware,
    expressPinoMiddleware(...params),
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      setValue(loggerKey, req.log);
      next();
    }
  ];
}

function hasLoggerParamsPassedLogger(params: Params): params is [PassedLogger] {
  return params[0] && "logger" in params[0];
}

// Copy from 'express-pino-logger' types
// because it's not building to own `.d.ts`
declare global {
  namespace Express {
    interface Request {
      log: pino.Logger;
    }
  }
}
