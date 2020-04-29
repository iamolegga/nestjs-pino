import * as express from 'express';
import { middleware as ctxMiddleware, setValue } from 'express-ctx';
import * as pinoHttp from 'pino-http';

import {
  DynamicModule,
  Global,
  Inject,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { Provider } from '@nestjs/common/interfaces';

import { LOGGER_KEY, LOGGER_OPTIONS } from './constants';
import { createProvidersForDecorated } from './InjectPinoLogger';
import { LoggerModuleAsyncOptions, LoggerOptions } from './interfaces';
import { Logger, PinoLogger } from './services';

const DEFAULT_ROUTES = [{ path: '*', method: RequestMethod.ALL }];

@Global()
@Module({ providers: [Logger], exports: [Logger] })
export class LoggerCoreModule implements NestModule {
  static forRoot(params: LoggerOptions | undefined): DynamicModule {
    const paramsProvider: Provider<LoggerOptions> = {
      provide: LOGGER_OPTIONS,
      useValue: params || {},
    };

    const decorated = createProvidersForDecorated();

    return {
      module: LoggerCoreModule,
      providers: [Logger, ...decorated, PinoLogger, paramsProvider],
      exports: [Logger, ...decorated, PinoLogger],
    };
  }

  static forRootAsync(params: LoggerModuleAsyncOptions): DynamicModule {
    const paramsProvider: Provider<LoggerOptions | Promise<LoggerOptions>> = {
      provide: LOGGER_OPTIONS,
      useFactory: params.useFactory,
      inject: params.inject,
    };

    const decorated = createProvidersForDecorated();

    const providers: any[] = [
      Logger,
      ...decorated,
      PinoLogger,
      paramsProvider,
      ...(params.providers || []),
    ];

    return {
      module: LoggerCoreModule,
      imports: params.imports,
      providers,
      exports: [Logger, ...decorated, PinoLogger],
    };
  }

  constructor(@Inject(LOGGER_OPTIONS) private readonly params: LoggerOptions) {}

  configure(consumer: MiddlewareConsumer) {
    const {
      exclude,
      forRoutes = DEFAULT_ROUTES,
      pinoHttp,
      useExisting,
    } = this.params;

    const middlewares = createLoggerMiddlewares(pinoHttp || {}, useExisting);

    if (exclude) {
      consumer
        .apply(...middlewares)
        .exclude(...exclude)
        .forRoutes(...forRoutes);
    } else {
      consumer.apply(...middlewares).forRoutes(...forRoutes);
    }
  }
}

function createLoggerMiddlewares(
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

function bindLoggerMiddleware(
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction,
) {
  setValue(LOGGER_KEY, req.log);
  next();
}
