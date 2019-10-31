import { Module, DynamicModule } from "@nestjs/common";
import { DestinationStream, LoggerOptions } from "pino";
import { PassedLogger, LoggerModuleAsyncOptions, Params } from "./params";
import { LoggerCoreModule } from "./LoggerCoreModule";

@Module({})
export class LoggerModule {
  static forRoot(
    opts?: Exclude<Params, [LoggerOptions, DestinationStream]>
  ): DynamicModule;
  static forRoot(opts: LoggerOptions, stream: DestinationStream): DynamicModule;
  static forRoot(opts?: Params, stream?: DestinationStream): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        LoggerCoreModule.forRoot(
          stream ? [opts as LoggerOptions, stream] : opts
        )
      ]
    };
  }

  static forRootAsync(options: LoggerModuleAsyncOptions): DynamicModule {
    return {
      module: LoggerModule,
      imports: [LoggerCoreModule.forRootAsync(options)]
    };
  }
}
