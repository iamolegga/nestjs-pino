import { DynamicModule, Module } from '@nestjs/common';

import { LoggerModuleAsyncOptions, LoggerOptions } from './interfaces';
import { LoggerCoreModule } from './logger-core.module';

@Module({})
export class LoggerModule {
  static forRoot(params?: LoggerOptions | undefined): DynamicModule {
    return {
      module: LoggerModule,
      imports: [LoggerCoreModule.forRoot(params)],
    };
  }

  static forRootAsync(params: LoggerModuleAsyncOptions): DynamicModule {
    return {
      module: LoggerModule,
      imports: [LoggerCoreModule.forRootAsync(params)],
    };
  }
}
