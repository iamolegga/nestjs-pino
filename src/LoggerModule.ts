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
import * as express from 'express';
import { pinoHttp } from 'pino-http';
import { Logger } from './Logger';
import {
  Params,
  LoggerModuleAsyncParams,
  PARAMS_PROVIDER_TOKEN,
} from './params';
import { PinoLogger } from './PinoLogger';
import { createProvidersForDecorated } from './InjectPinoLogger';
import { Store, storage } from './storage';

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
  params: NonNullable<Params['pinoHttp']>,
  useExisting?: true,
) {
  if (useExisting) {
    return [bindLoggerMiddleware];
  }

  if (Array.isArray(params)) {
    const middleware = pinoHttp(...params);
    // @ts-expect-error: root is readonly field, but this is the place where
    // it's set actually
    PinoLogger.root = middleware.logger;
    return [middleware, bindLoggerMiddleware];
  }

  const middleware = pinoHttp(params as any);
  // @ts-expect-error: root is readonly field, but this is the place where
  // it's set actually
  PinoLogger.root = middleware.logger;

  // FIXME: params type here is pinoHttp.Options | pino.DestinationStream
  // pinoHttp has two overloads, each of them takes those types
  return [middleware, bindLoggerMiddleware];
}

function bindLoggerMiddleware(
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction,
) {
  // @ts-ignore: run requires arguments for next but should not because it can
  // be called without arguments
  storage.run(new Store(req.log), next);
}
