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
exports.Logger = void 0;
const common_1 = require("@nestjs/common");
const PinoLogger_1 = require("./PinoLogger");
const constants_1 = require("./constants");
let Logger = class Logger {
    constructor(logger, { renameContext }) {
        this.logger = logger;
        this.contextName = renameContext || "context";
    }
    verbose(message, context, ...args) {
        if (context) {
            this.logger.trace({ [this.contextName]: context }, message, ...args);
        }
        else {
            this.logger.trace(message, ...args);
        }
    }
    debug(message, context, ...args) {
        if (context) {
            this.logger.debug({ [this.contextName]: context }, message, ...args);
        }
        else {
            this.logger.debug(message, ...args);
        }
    }
    log(message, context, ...args) {
        if (context) {
            this.logger.info({ [this.contextName]: context }, message, ...args);
        }
        else {
            this.logger.info(message, ...args);
        }
    }
    warn(message, context, ...args) {
        if (context) {
            this.logger.warn({ [this.contextName]: context }, message, ...args);
        }
        else {
            this.logger.warn(message, ...args);
        }
    }
    error(message, trace, context, ...args) {
        if (context) {
            this.logger.error({ [this.contextName]: context, trace }, message, ...args);
        }
        else if (trace) {
            this.logger.error({ trace }, message, ...args);
        }
        else {
            this.logger.error(message, ...args);
        }
    }
};
Logger = __decorate([
    common_1.Injectable(),
    __param(1, common_1.Inject(constants_1.PARAMS_PROVIDER_TOKEN)),
    __metadata("design:paramtypes", [PinoLogger_1.PinoLogger, Object])
], Logger);
exports.Logger = Logger;
//# sourceMappingURL=Logger.js.map