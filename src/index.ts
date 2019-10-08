import {
  Injectable,
  LoggerService,
  Global,
  Module,
  DynamicModule,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
  Inject
} from "@nestjs/common";
import { ModuleMetadata, Provider } from "@nestjs/common/interfaces";
import express from "express";
import pinoHttp from "pino-http";
import pino, { LoggerOptions, DestinationStream } from "pino";
import { getValue, setValue, middleware as ctxMiddleware } from "express-ctx";

type PassedLogger = { logger: pino.Logger };

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

const LOGGER_KEY = "logger";

const OPTIONS_PROVIDER_TOKEN = "pino-options";

@Injectable()
export class Logger implements LoggerService {
  private readonly outOfContext: pino.Logger;

  constructor(@Inject(OPTIONS_PROVIDER_TOKEN) options: Params) {
    if (Array.isArray(options)) {
      this.outOfContext = pino(...options);
    } else if (isPassedLogger(options)) {
      this.outOfContext = options.logger;
    } else {
      this.outOfContext = pino(options || undefined);
    }
  }

  verbose(message: any, context?: string, ...args: any[]) {
    if (context) {
      this.logger.trace({ context }, message, ...args);
    } else {
      this.logger.trace(message);
    }
  }

  debug(message: any, context?: string, ...args: any[]) {
    if (context) {
      this.logger.debug({ context }, message, ...args);
    } else {
      this.logger.debug(message);
    }
  }

  log(message: any, context?: string, ...args: any[]) {
    if (context) {
      this.logger.info({ context }, message, ...args);
    } else {
      this.logger.info(message);
    }
  }

  warn(message: any, context?: string, ...args: any[]) {
    if (context) {
      this.logger.warn({ context }, message, ...args);
    } else {
      this.logger.warn(message);
    }
  }

  error(message: any, trace?: string, context?: string, ...args: any[]) {
    if (context) {
      this.logger.error({ context, trace }, message, ...args);
    } else if (trace) {
      this.logger.error({ trace }, message);
    } else {
      this.logger.error(message);
    }
  }

  private get logger() {
    return getValue<pino.Logger>(LOGGER_KEY) || this.outOfContext;
  }
}

@Module({})
export class LoggerModule {
  static forRoot(
    opts?: PassedLogger | LoggerOptions | DestinationStream
  ): DynamicModule;
  static forRoot(opts: LoggerOptions, stream: DestinationStream): DynamicModule;
  static forRoot(
    opts?: PassedLogger | LoggerOptions | DestinationStream,
    stream?: DestinationStream
  ): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        LoggerCoreModule.forRoot(
          stream ? [opts as LoggerOptions, stream] : opts
        )
      ]
    };
  }

  static forRootAsync(options: LoggerModuleAsyncOptions): DynamicModule {
    return {
      module: LoggerModule,
      imports: [LoggerCoreModule.forRootAsync(options)]
    };
  }
}

@Global()
@Module({ providers: [Logger], exports: [Logger] })
class LoggerCoreModule implements NestModule {
  static forRoot(options: Params | undefined): DynamicModule {
    const optionsProvider: Provider<Params> = {
      provide: OPTIONS_PROVIDER_TOKEN,
      useValue: options || null
    };

    return {
      module: LoggerCoreModule,
      providers: [Logger, optionsProvider],
      exports: [Logger]
    };
  }

  static forRootAsync(options: LoggerModuleAsyncOptions): DynamicModule {
    const optionsProvider: Provider<Params | Promise<Params>> = {
      provide: OPTIONS_PROVIDER_TOKEN,
      useFactory: options.useFactory,
      inject: options.inject
    };

    return {
      module: LoggerCoreModule,
      imports: options.imports,
      providers: options.providers
        ? [Logger, optionsProvider, ...options.providers]
        : [Logger, optionsProvider],
      exports: [Logger]
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

function isPassedLogger(
  params: PassedLogger | LoggerOptions | DestinationStream | null
): params is PassedLogger {
  return !!params && "logger" in params;
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
