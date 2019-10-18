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
import { OPTIONS_PROVIDER_TOKEN, LOGGER_KEY } from "./constants";
import { Params, LoggerModuleAsyncOptions } from "./params";
import { PinoLogger } from "./PinoLogger";
import { createProvidersForDecorated } from "./InjectPinoLogger";

@Global()
@Module({ providers: [Logger], exports: [Logger] })
export class LoggerCoreModule implements NestModule {
  static forRoot(options: Params | undefined): DynamicModule {
    const optionsProvider: Provider<Params> = {
      provide: OPTIONS_PROVIDER_TOKEN,
      useValue: options || null
    };

    const decorated = createProvidersForDecorated();

    return {
      module: LoggerCoreModule,
      providers: [Logger, ...decorated, PinoLogger, optionsProvider],
      exports: [Logger, ...decorated, PinoLogger]
    };
  }

  static forRootAsync(options: LoggerModuleAsyncOptions): DynamicModule {
    const optionsProvider: Provider<Params | Promise<Params>> = {
      provide: OPTIONS_PROVIDER_TOKEN,
      useFactory: options.useFactory,
      inject: options.inject
    };

    const decorated = createProvidersForDecorated();

    const providers: any[] = [
      Logger,
      ...decorated,
      PinoLogger,
      optionsProvider,
      ...(options.providers || [])
    ];

    return {
      module: LoggerCoreModule,
      imports: options.imports,
      providers,
      exports: [Logger, ...decorated, PinoLogger]
    };
  }

  constructor(
    @Inject(OPTIONS_PROVIDER_TOKEN) private readonly options: Params
  ) {}

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(...createLoggerMiddlewares(this.options))
      .forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}

function createLoggerMiddlewares(params: Params) {
  const middleware = Array.isArray(params)
    ? pinoHttp(...params)
    : pinoHttp((params as pinoHttp.Options) || undefined);

  return [ctxMiddleware, middleware, bindLoggerMiddleware];
}

function bindLoggerMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  setValue(LOGGER_KEY, req.log);
  next();
}
