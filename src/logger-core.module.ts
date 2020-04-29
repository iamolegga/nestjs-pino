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

import { createLoggerMiddlewares } from './common';
import { LOGGER_OPTIONS } from './constants';
import { LoggerModuleAsyncOptions, LoggerOptions } from './interfaces';
import { createProvidersForDecorated } from './logger.providers';
import { Logger, PinoLogger } from './services';

const DEFAULT_ROUTES = [{ path: '*', method: RequestMethod.ALL }];

@Global()
@Module({ providers: [Logger], exports: [Logger] })
export class LoggerCoreModule implements NestModule {
  static forRoot(options: LoggerOptions | undefined): DynamicModule {
    const paramsProvider: Provider<LoggerOptions> = {
      provide: LOGGER_OPTIONS,
      useValue: options || {},
    };

    const decorated = createProvidersForDecorated();

    return {
      module: LoggerCoreModule,
      providers: [Logger, ...decorated, PinoLogger, paramsProvider],
      exports: [Logger, ...decorated, PinoLogger],
    };
  }

  static forRootAsync(options: LoggerModuleAsyncOptions): DynamicModule {
    const paramsProvider: Provider<LoggerOptions | Promise<LoggerOptions>> = {
      provide: LOGGER_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject,
    };

    const decorated = createProvidersForDecorated();

    const providers: any[] = [
      Logger,
      ...decorated,
      PinoLogger,
      paramsProvider,
      ...(options.providers || []),
    ];

    return {
      module: LoggerCoreModule,
      imports: options.imports,
      providers,
      exports: [Logger, ...decorated, PinoLogger],
    };
  }

  constructor(
    @Inject(LOGGER_OPTIONS) private readonly options: LoggerOptions,
  ) {}

  configure(consumer: MiddlewareConsumer) {
    const {
      exclude,
      forRoutes = DEFAULT_ROUTES,
      pinoHttp: pHttp,
      useExisting,
    } = this.options;

    const middlewares = createLoggerMiddlewares(pHttp || {}, useExisting);

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
