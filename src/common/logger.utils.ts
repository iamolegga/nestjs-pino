import * as express from 'express';
import { middleware as ctxMiddleware, setValue } from 'express-ctx';
import * as pino from 'pino';
import * as pinoHttp from 'pino-http';

import { LOGGER_KEY } from '../constants';
import { LoggerOptions } from '../interfaces';

const decoratedTokenPrefix = 'PinoLogger:';

export function getLoggerToken(context: string): string {
  return `${decoratedTokenPrefix}${context}`;
}

export type PassedLogger = { logger: pino.Logger };

export function isPassedLogger(
  pinoHttpProp: any,
): pinoHttpProp is PassedLogger {
  return !!pinoHttpProp && 'logger' in pinoHttpProp;
}

function bindLoggerMiddleware(
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction,
) {
  setValue(LOGGER_KEY, req.log);
  next();
}

export function createLoggerMiddlewares(
  params: NonNullable<LoggerOptions['pinoHttp']>,
  useExisting?: true,
) {
  if (useExisting) {
    return [ctxMiddleware, bindLoggerMiddleware];
  }

  if (Array.isArray(params)) {
    return [ctxMiddleware, pinoHttp(...params), bindLoggerMiddleware];
  }

  // FIXME: params type here is pinoHttp.Options | pino.DestinationStream
  // pinoHttp has two overloads, each of them takes those types
  return [ctxMiddleware, pinoHttp(params as any), bindLoggerMiddleware];
}
