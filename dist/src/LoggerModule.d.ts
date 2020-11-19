import { DynamicModule } from "@nestjs/common";
import { LoggerModuleAsyncParams, Params } from "./params";
export declare class LoggerModule {
    static forRoot(params?: Params | undefined): DynamicModule;
    static forRootAsync(params: LoggerModuleAsyncParams): DynamicModule;
}
