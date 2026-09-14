import { IncomingMessage, ServerResponse } from 'node:http';

import {
  type DynamicModule,
  Global,
  Inject,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  type Provider,
  RequestMethod,
} from '@nestjs/common';
import { ApplicationConfig } from '@nestjs/core';

import { createProvidersForDecorated } from './InjectPinoLogger';
import { Logger } from './Logger';
import {
  getMicroserviceHook,
  PINO_PRE_REQUEST_HOOK,
  registerMicroserviceHook,
} from './microservice';
import { NativeLogger } from './NativeLogger';
import { PinoLogger } from './PinoLogger';
import {
  type LoggerModuleAsyncParams,
  PARAMS_PROVIDER_TOKEN,
  type Params,
} from './params';
import { ensureLoggerMiddleware, ensureRootLogger } from './rootLogger';
import { Store, storage } from './storage';

/**
 * path-to-regexp v8, used by express@5 and @fastify/middie@9, no longer accepts
 * the unnamed `*` wildcard: NestJS auto-converts it, but warns while doing so
 * as soon as a global prefix is set.
 *
 * The missing leading slash is deliberate, and is supported upstream: since
 * @nestjs/common@11.0.8 `addLeadingSlash` leaves a path starting with `{/`
 * alone. A global prefix is then applied as `/v1{/*splat}` rather than
 * `/v1/{*splat}`, which matters because the latter does not match the prefix
 * root itself — `/v1` would go unlogged, while `/v1/anything` would not.
 */
const DEFAULT_ROUTES = [{ path: '{/*splat}', method: RequestMethod.ALL }];

@Global()
@Module({ providers: [Logger, NativeLogger], exports: [Logger, NativeLogger] })
export class LoggerModule implements NestModule {
  static forRoot<
    IM = IncomingMessage,
    SR = ServerResponse,
    CustomLevels extends string = never,
  >(params?: Params<IM, SR, CustomLevels>): DynamicModule {
    const paramsProvider: Provider<Params<IM, SR, CustomLevels>> = {
      provide: PARAMS_PROVIDER_TOKEN,
      useValue: params || {},
    };

    const decorated = createProvidersForDecorated();
    const hookProvider = createHookProvider();

    return {
      module: LoggerModule,
      providers: [
        Logger,
        NativeLogger,
        ...decorated,
        PinoLogger,
        paramsProvider,
        hookProvider,
      ],
      exports: [
        Logger,
        NativeLogger,
        ...decorated,
        PinoLogger,
        paramsProvider,
        hookProvider,
      ],
    };
  }

  static forRootAsync<
    IM = IncomingMessage,
    SR = ServerResponse,
    CustomLevels extends string = never,
  >(params: LoggerModuleAsyncParams<IM, SR, CustomLevels>): DynamicModule {
    const paramsProvider: Provider<
      Params<IM, SR, CustomLevels> | Promise<Params<IM, SR, CustomLevels>>
    > = {
      provide: PARAMS_PROVIDER_TOKEN,
      useFactory: params.useFactory,
      inject: params.inject,
    };

    const decorated = createProvidersForDecorated();
    const hookProvider = createHookProvider();

    const providers: any[] = [
      Logger,
      NativeLogger,
      ...decorated,
      PinoLogger,
      paramsProvider,
      hookProvider,
      ...(params.providers || []),
    ];

    return {
      module: LoggerModule,
      imports: params.imports,
      providers,
      exports: [
        Logger,
        NativeLogger,
        ...decorated,
        PinoLogger,
        paramsProvider,
        hookProvider,
      ],
    };
  }

  constructor(
    @Inject(PARAMS_PROVIDER_TOKEN) private readonly params: Params,
    private readonly applicationConfig: ApplicationConfig,
  ) {
    // Microservices have no middleware, so `configure` is never called for
    // them. The hook is registered here instead, early enough that the message
    // handlers being built later pick it up.
    if (params.microservice) {
      ensureRootLogger(params.pinoHttp);
      registerMicroserviceHook(applicationConfig, params);
    }
  }

  configure(consumer: MiddlewareConsumer) {
    const {
      exclude,
      forRoutes = this.defaultRoutes(),
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

  /**
   * A path excluded from the global prefix is served outside of it, while
   * `DEFAULT_ROUTES` is prefixed like any other middleware route, so such a
   * path would go unlogged. NestJS adds excluded paths back on its own, but
   * only for routes that `RouteInfoPathExtractor.isAWildcard` recognises —
   * which `{/*splat}`, with its leading slash deliberately missing, is not.
   *
   * Only the default applies: an explicit `forRoutes` is the user's own call.
   */
  private defaultRoutes() {
    const { exclude } = this.applicationConfig.getGlobalPrefixOptions();

    return [
      ...DEFAULT_ROUTES,
      ...(exclude ?? []).map(({ path, requestMethod }) => ({
        path,
        method: requestMethod,
      })),
    ];
  }
}

/**
 * Exposes the very hook the module registers on its own, for the one case it
 * cannot reach: a hybrid application connected without `inheritAppConfig`.
 */
function createHookProvider(): Provider {
  return {
    provide: PINO_PRE_REQUEST_HOOK,
    useFactory: (params: Params) => {
      ensureRootLogger(params.pinoHttp);
      return getMicroserviceHook(params);
    },
    inject: [PARAMS_PROVIDER_TOKEN],
  };
}

function createLoggerMiddlewares(
  params: NonNullable<Params['pinoHttp']>,
  useExisting = false,
  assignResponse = false,
) {
  if (useExisting) {
    return [bindLoggerMiddlewareFactory(useExisting, assignResponse)];
  }

  // The same instance the rest of the application already logs through, rather
  // than a second one built here: one `transport`, and a `PinoLogger.root` that
  // governs every log in the application, request-scoped or not.
  const middleware = ensureLoggerMiddleware(params);

  // @ts-expect-error: root is readonly field, but this is the place where
  // it's set actually
  PinoLogger.root = middleware.logger;

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
