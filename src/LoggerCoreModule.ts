import {
  Global,
  Module,
  DynamicModule,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
  Inject
} from "@nestjs/common";
import { Provider } from "@nestjs/common/interfaces";
import * as express from "express";
import * as pinoHttp from "pino-http";
import { setValue, middleware as ctxMiddleware } from "express-ctx";
import { Logger } from "./Logger";
import { PARAMS_PROVIDER_TOKEN, LOGGER_KEY } from "./constants";
import { Params, LoggerModuleAsyncParams } from "./params";
import { PinoLogger } from "./PinoLogger";
import { createProvidersForDecorated } from "./InjectPinoLogger";

const DEFAULT_ROUTES = [{ path: "*", method: RequestMethod.ALL }];

@Global()
@Module({ providers: [Logger], exports: [Logger] })
export class LoggerCoreModule implements NestModule {
  static forRoot(params: Params | undefined): DynamicModule {
    const paramsProvider: Provider<Params> = {
      provide: PARAMS_PROVIDER_TOKEN,
      useValue: params || {}
    };

    const decorated = createProvidersForDecorated();

    return {
      module: LoggerCoreModule,
      providers: [Logger, ...decorated, PinoLogger, paramsProvider],
      exports: [Logger, ...decorated, PinoLogger]
    };
  }

  static forRootAsync(params: LoggerModuleAsyncParams): DynamicModule {
    const paramsProvider: Provider<Params | Promise<Params>> = {
      provide: PARAMS_PROVIDER_TOKEN,
      useFactory: params.useFactory,
      inject: params.inject
    };

    const decorated = createProvidersForDecorated();

    const providers: any[] = [
      Logger,
      ...decorated,
      PinoLogger,
      paramsProvider,
      ...(params.providers || [])
    ];

    return {
      module: LoggerCoreModule,
      imports: params.imports,
      providers,
      exports: [Logger, ...decorated, PinoLogger]
    };
  }

  constructor(@Inject(PARAMS_PROVIDER_TOKEN) private readonly params: Params) {}

  configure(consumer: MiddlewareConsumer) {
    const {
      exclude,
      forRoutes = DEFAULT_ROUTES,
      pinoHttp,
      useExisting
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
  params: NonNullable<Params["pinoHttp"]>,
  useExisting?: true
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
  next: express.NextFunction
) {
  setValue(LOGGER_KEY, req.log);
  next();
}
