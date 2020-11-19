"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var LoggerCoreModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerCoreModule = void 0;
const common_1 = require("@nestjs/common");
const pinoHttp = require("pino-http");
const pino_multi_stream_1 = require("pino-multi-stream");
const express_ctx_1 = require("express-ctx");
const Sentry = require("@sentry/node");
const Logger_1 = require("./Logger");
const constants_1 = require("./constants");
const PinoLogger_1 = require("./PinoLogger");
const InjectPinoLogger_1 = require("./InjectPinoLogger");
const DEFAULT_ROUTES = [{ path: "*", method: common_1.RequestMethod.ALL }];
let LoggerCoreModule = LoggerCoreModule_1 = class LoggerCoreModule {
    constructor(params) {
        this.params = params;
    }
    static forRoot(params) {
        const paramsProvider = {
            provide: constants_1.PARAMS_PROVIDER_TOKEN,
            useValue: params || {}
        };
        const decorated = InjectPinoLogger_1.createProvidersForDecorated();
        return {
            module: LoggerCoreModule_1,
            providers: [Logger_1.Logger, ...decorated, PinoLogger_1.PinoLogger, paramsProvider],
            exports: [Logger_1.Logger, ...decorated, PinoLogger_1.PinoLogger]
        };
    }
    static forRootAsync(params) {
        const paramsProvider = {
            provide: constants_1.PARAMS_PROVIDER_TOKEN,
            useFactory: params.useFactory,
            inject: params.inject
        };
        const decorated = InjectPinoLogger_1.createProvidersForDecorated();
        const providers = [
            Logger_1.Logger,
            ...decorated,
            PinoLogger_1.PinoLogger,
            paramsProvider,
            ...(params.providers || [])
        ];
        return {
            module: LoggerCoreModule_1,
            imports: params.imports,
            providers,
            exports: [Logger_1.Logger, ...decorated, PinoLogger_1.PinoLogger]
        };
    }
    configure(consumer) {
        const { exclude, forRoutes = DEFAULT_ROUTES, pinoHttp, useExisting, sentry: sentryConfig, } = this.params;
        Sentry.init(sentryConfig || {});
        const middlewares = createLoggerMiddlewares(pinoHttp || {}, useExisting);
        if (exclude) {
            consumer
                .apply(...middlewares)
                .exclude(...exclude)
                .forRoutes(...forRoutes);
        }
        else {
            consumer.apply(...middlewares).forRoutes(...forRoutes);
        }
    }
};
LoggerCoreModule = LoggerCoreModule_1 = __decorate([
    common_1.Global(),
    common_1.Module({ providers: [Logger_1.Logger], exports: [Logger_1.Logger] }),
    __param(0, common_1.Inject(constants_1.PARAMS_PROVIDER_TOKEN)),
    __metadata("design:paramtypes", [Object])
], LoggerCoreModule);
exports.LoggerCoreModule = LoggerCoreModule;
function createLoggerMiddlewares(params, useExisting) {
    if (useExisting) {
        return [express_ctx_1.middleware, bindLoggerMiddleware];
    }
    if (Array.isArray(params)) {
        return [express_ctx_1.middleware, pinoHttp(...params), bindLoggerMiddleware];
    }
    const client = {
        level: 'warn',
        stream: {
            write: (record) => {
                const data = JSON.parse(record);
                Sentry.captureEvent({
                    // @ts-ignore
                    level: 'error',
                    timestamp: data.time,
                    message: data.msg,
                    extra: data,
                });
            },
        },
    };
    // FIXME: params type here is pinoHttp.Options | pino.DestinationStream
    // pinoHttp has two overloads, each of them takes those types
    // @ts-ignore
    return [express_ctx_1.middleware, pinoHttp(params, pino_multi_stream_1.multistream([client])), bindLoggerMiddleware];
}
function bindLoggerMiddleware(req, _res, next) {
    express_ctx_1.setValue(constants_1.LOGGER_KEY, req.log);
    next();
}
//# sourceMappingURL=LoggerCoreModule.js.map