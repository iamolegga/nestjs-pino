/* eslint-disable @typescript-eslint/no-explicit-any */
import { IncomingMessage, ServerResponse } from 'node:http';

import {
  Global,
  Module,
  DynamicModule,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
  Inject,
} from '@nestjs/common';
import { Provider } from '@nestjs/common/interfaces';
import { pinoHttp } from 'pino-http';

import { createProvidersForDecorated } from './InjectPinoLogger';
import { Logger } from './Logger';
import {
  Params,
  LoggerModuleAsyncParams,
  PARAMS_PROVIDER_TOKEN,
} from './params';
import { PinoLogger } from './PinoLogger';
import { Store, storage } from './storage';

/**
 * As NestJS@11 still supports express@4 `*`-style routing by itself let's keep
 * it for the backward compatibility. On the next major NestJS release `*` we
 * can replace it with `/{*splat}`, and drop the support for NestJS@9 and below.
 */
const DEFAULT_ROUTES = [{ path: '*', method: RequestMethod.ALL }];

@Global()
@Module({ providers: [Logger], exports: [Logger] })
export class LoggerModule implements NestModule {
  static forRoot(params?: Params | undefined): DynamicModule {
    const paramsProvider: Provider<Params> = {
      provide: PARAMS_PROVIDER_TOKEN,
      useValue: params || {},
    };

    const decorated = createProvidersForDecorated();

    return {
      module: LoggerModule,
      providers: [Logger, ...decorated, PinoLogger, paramsProvider],
      exports: [Logger, ...decorated, PinoLogger, paramsProvider],
    };
  }

  static forRootAsync(params: LoggerModuleAsyncParams): DynamicModule {
    const paramsProvider: Provider<Params | Promise<Params>> = {
      provide: PARAMS_PROVIDER_TOKEN,
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
      module: LoggerModule,
      imports: params.imports,
      providers,
      exports: [Logger, ...decorated, PinoLogger, paramsProvider],
    };
  }

  constructor(@Inject(PARAMS_PROVIDER_TOKEN) private readonly params: Params) {}

  configure(consumer: MiddlewareConsumer) {
    const {
      exclude,
      forRoutes = DEFAULT_ROUTES,
      pinoHttp,
      useExisting,
      assignResponse,
    } = this.params;

    const middlewares = createLoggerMiddlewares(
      pinoHttp || {},
      useExisting,
      assignResponse,
    );

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
  params: NonNullable<Params['pinoHttp']>,
  useExisting = false,
  assignResponse = false,
) {
  if (useExisting) {
    return [bindLoggerMiddlewareFactory(useExisting, assignResponse)];
  }

  const middleware = pinoHttp(
    ...(Array.isArray(params) ? params : [params as any]),
  );

  // @ts-expect-error: root is readonly field, but this is the place where
  // it's set actually
  PinoLogger.root = middleware.logger;

  // FIXME: params type here is pinoHttp.Options | pino.DestinationStream
  // pinoHttp has two overloads, each of them takes those types
  return [middleware, bindLoggerMiddlewareFactory(useExisting, assignResponse)];
}

function bindLoggerMiddlewareFactory(
  useExisting: boolean,
  assignResponse: boolean,
) {
  return function bindLoggerMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) {
    let log = req.log;
    let resLog = assignResponse ? res.log : undefined;

    if (!useExisting && req.allLogs) {
      log = req.allLogs[req.allLogs.length - 1]!;
    }
    if (assignResponse && !useExisting && res.allLogs) {
      resLog = res.allLogs[res.allLogs.length - 1]!;
    }

    storage.run(new Store(log, resLog), next);
  };
}
