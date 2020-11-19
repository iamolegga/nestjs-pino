import { LoggerService } from "@nestjs/common";
import { PinoLogger } from "./PinoLogger";
import { Params } from "./params";
export declare class Logger implements LoggerService {
    private readonly logger;
    private readonly contextName;
    constructor(logger: PinoLogger, { renameContext }: Params);
    verbose(message: any, context?: string, ...args: any[]): void;
    debug(message: any, context?: string, ...args: any[]): void;
    log(message: any, context?: string, ...args: any[]): void;
    warn(message: any, context?: string, ...args: any[]): void;
    error(message: any, trace?: string, context?: string, ...args: any[]): void;
}
