"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLoggerToken = exports.createProvidersForDecorated = exports.InjectPinoLogger = void 0;
const common_1 = require("@nestjs/common");
const PinoLogger_1 = require("./PinoLogger");
const decoratedTokenPrefix = "PinoLogger:";
const decoratedLoggers = new Set();
function InjectPinoLogger(context = "") {
    decoratedLoggers.add(context);
    return common_1.Inject(getLoggerToken(context));
}
exports.InjectPinoLogger = InjectPinoLogger;
function createDecoratedLoggerProvider(context) {
    return {
        provide: getLoggerToken(context),
        useFactory: (logger) => {
            logger.setContext(context);
            return logger;
        },
        inject: [PinoLogger_1.PinoLogger]
    };
}
function createProvidersForDecorated() {
    return [...decoratedLoggers.values()].map(context => createDecoratedLoggerProvider(context));
}
exports.createProvidersForDecorated = createProvidersForDecorated;
function getLoggerToken(context) {
    return `${decoratedTokenPrefix}${context}`;
}
exports.getLoggerToken = getLoggerToken;
//# sourceMappingURL=InjectPinoLogger.js.map