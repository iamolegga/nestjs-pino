"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPassedLogger = void 0;
function isPassedLogger(pinoHttpProp) {
    return !!pinoHttpProp && "logger" in pinoHttpProp;
}
exports.isPassedLogger = isPassedLogger;
//# sourceMappingURL=params.js.map