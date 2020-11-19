import { DynamicModule, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { Params, LoggerModuleAsyncParams } from "./params";
export declare class LoggerCoreModule implements NestModule {
    private readonly params;
    static forRoot(params: Params | undefined): DynamicModule;
    static forRootAsync(params: LoggerModuleAsyncParams): DynamicModule;
    constructor(params: Params);
    configure(consumer: MiddlewareConsumer): void;
}
