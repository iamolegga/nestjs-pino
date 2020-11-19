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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PinoLogger = exports.__resetOutOfContextForTests = void 0;
const common_1 = require("@nestjs/common");
const pino = require("pino");
const express_ctx_1 = require("express-ctx");
const constants_1 = require("./constants");
const params_1 = require("./params");
let outOfContext;
function __resetOutOfContextForTests() {
    // only for tests
    // @ts-ignore
    outOfContext = undefined;
}
exports.__resetOutOfContextForTests = __resetOutOfContextForTests;
let PinoLogger = class PinoLogger {
    constructor({ pinoHttp, renameContext }) {
        this.context = "";
        if (!outOfContext) {
            if (Array.isArray(pinoHttp)) {
                outOfContext = pino(...pinoHttp);
            }
            else if (params_1.isPassedLogger(pinoHttp)) {
                outOfContext = pinoHttp.logger;
            }
            else {
                outOfContext = pino(pinoHttp);
            }
        }
        this.contextName = renameContext || "context";
    }
    trace(...args) {
        this.call("trace", ...args);
    }
    debug(...args) {
        this.call("debug", ...args);
    }
    info(...args) {
        this.call("info", ...args);
    }
    warn(...args) {
        this.call("warn", ...args);
    }
    error(...args) {
        this.call("error", ...args);
    }
    fatal(...args) {
        this.call("fatal", ...args);
    }
    setContext(value) {
        this.context = value;
    }
    call(method, ...args) {
        const context = this.context;
        if (context) {
            const firstArg = args[0];
            if (typeof firstArg === "object") {
                if (firstArg instanceof Error) {
                    args = [
                        Object.assign({ [this.contextName]: context }, { err: firstArg }),
                        ...args.slice(1)
                    ];
                }
                else {
                    args = [
                        Object.assign({ [this.contextName]: context }, firstArg),
                        ...args.slice(1)
                    ];
                }
            }
            else {
                args = [{ [this.contextName]: context }, ...args];
            }
        }
        this.logger[method](...args);
    }
    get logger() {
        return express_ctx_1.getValue(constants_1.LOGGER_KEY) || outOfContext;
    }
};
PinoLogger = __decorate([
    common_1.Injectable({ scope: common_1.Scope.TRANSIENT }),
    __param(0, common_1.Inject(constants_1.PARAMS_PROVIDER_TOKEN)),
    __metadata("design:paramtypes", [Object])
], PinoLogger);
exports.PinoLogger = PinoLogger;
//# sourceMappingURL=PinoLogger.js.map