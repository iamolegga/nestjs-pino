import * as pino from "pino";
import { Params } from "./params";
interface PinoMethods extends Pick<pino.BaseLogger, "trace" | "debug" | "info" | "warn" | "error" | "fatal"> {
}
export declare function __resetOutOfContextForTests(): void;
export declare class PinoLogger implements PinoMethods {
    private context;
    private readonly contextName;
    constructor({ pinoHttp, renameContext }: Params);
    trace(msg: string, ...args: any[]): void;
    trace(obj: object, msg?: string, ...args: any[]): void;
    debug(msg: string, ...args: any[]): void;
    debug(obj: object, msg?: string, ...args: any[]): void;
    info(msg: string, ...args: any[]): void;
    info(obj: object, msg?: string, ...args: any[]): void;
    warn(msg: string, ...args: any[]): void;
    warn(obj: object, msg?: string, ...args: any[]): void;
    error(msg: string, ...args: any[]): void;
    error(obj: object, msg?: string, ...args: any[]): void;
    fatal(msg: string, ...args: any[]): void;
    fatal(obj: object, msg?: string, ...args: any[]): void;
    setContext(value: string): void;
    private call;
    private get logger();
}
export {};
