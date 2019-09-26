import {
  Injectable,
  LoggerService,
  Global,
  Module,
  DynamicModule,
  NestModule,
  MiddlewareConsumer,
  RequestMethod
} from "@nestjs/common";
import express from "express";
import expressPinoMiddleware from "express-pino-logger";
import pino, { LoggerOptions, DestinationStream } from "pino";
import { getValue, setValue, middleware as ctxMiddleware } from "express-ctx";

type PassedLogger = { logger: pino.Logger };

type Params =
  | []
  | [PassedLogger]
  | [LoggerOptions | DestinationStream]
  | [LoggerOptions, DestinationStream];

let outOfContextLogger: pino.Logger;

const loggerKey = "logger";

let rootParams: Params;

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

@Global()
@Module({
  providers: [Logger],
  exports: [Logger]
})
export class LoggerModule implements NestModule {
  static forRoot(...params: Params): DynamicModule {
    rootParams = params;

    if (hasLoggerParamsPassedLogger(rootParams)) {
      outOfContextLogger = rootParams[0].logger;
    } else {
      outOfContextLogger = pino(...rootParams);
    }

    return {
      module: LoggerModule,
      providers: [Logger],
      exports: [Logger]
    };
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(...createLoggerMiddlewares())
      .forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}

function createLoggerMiddlewares() {
  return [
    ctxMiddleware,
    expressPinoMiddleware(...rootParams),
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

// Copy from 'express-pino-logger' types because it's not builds to own `.d.ts`
declare global {
  namespace Express {
    interface Request {
      log: pino.Logger;
    }
  }
}
