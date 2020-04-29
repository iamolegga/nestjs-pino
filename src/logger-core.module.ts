import {
    DynamicModule, Global, Inject, MiddlewareConsumer, Module, NestModule, RequestMethod
} from '@nestjs/common';
import { Provider } from '@nestjs/common/interfaces';

import { createLoggerMiddlewares } from './common';
import { LOGGER_OPTIONS } from './constants';
import { LoggerModuleAsyncOptions, LoggerOptions, LoggerOptionsFactory } from './interfaces';
import { createLoggerProviders, createProvidersForDecorated } from './logger.providers';
import { Logger, PinoLogger } from './services';

const DEFAULT_ROUTES = [{ path: '*', method: RequestMethod.ALL }];

@Global()
@Module({ providers: [Logger], exports: [Logger] })
export class LoggerCoreModule implements NestModule {
  static forRoot(options: LoggerOptions = {}): DynamicModule {
    const providers = createLoggerProviders(options);

    return {
      module: LoggerCoreModule,
      providers,
      exports: providers,
    };
  }

  static forRootAsync(options: LoggerModuleAsyncOptions): DynamicModule {
    const exportsProviders = [
      Logger,
      ...createProvidersForDecorated(),
      PinoLogger,
    ];

    const providers = [
      ...exportsProviders,
      ...this.createProviders(options),
      ...(options.providers || []),
    ];

    return {
      module: LoggerCoreModule,
      imports: options.imports,
      providers,
      exports: exportsProviders,
    };
  }

  private static createProviders(
    options: LoggerModuleAsyncOptions,
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createOptionsProvider(options)];
    }

    return [
      this.createOptionsProvider(options),
      {
        provide: options.useClass!,
        useClass: options.useClass!,
      },
    ];
  }

  private static createOptionsProvider(
    options: LoggerModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: LOGGER_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    // For useExisting...
    return {
      provide: LOGGER_OPTIONS,
      useFactory: async (optionsFactory: LoggerOptionsFactory) =>
        await optionsFactory.createLoggerOptions(),
      // inject: [options.useExisting || options.useClass],
      inject: [options.useExisting ? options.useExisting : options.useClass!],
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
