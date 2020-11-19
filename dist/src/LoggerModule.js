"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var LoggerModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerModule = void 0;
const common_1 = require("@nestjs/common");
const LoggerCoreModule_1 = require("./LoggerCoreModule");
let LoggerModule = LoggerModule_1 = class LoggerModule {
    static forRoot(params) {
        return {
            module: LoggerModule_1,
            imports: [LoggerCoreModule_1.LoggerCoreModule.forRoot(params)]
        };
    }
    static forRootAsync(params) {
        return {
            module: LoggerModule_1,
            imports: [LoggerCoreModule_1.LoggerCoreModule.forRootAsync(params)]
        };
    }
};
LoggerModule = LoggerModule_1 = __decorate([
    common_1.Module({})
], LoggerModule);
exports.LoggerModule = LoggerModule;
//# sourceMappingURL=LoggerModule.js.map