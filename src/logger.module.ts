import { DynamicModule, Module } from '@nestjs/common';

import { LoggerModuleAsyncOptions, LoggerOptions } from './interfaces';
import { LoggerCoreModule } from './logger-core.module';

@Module({})
export class LoggerModule {
  static forRoot(options?: LoggerOptions | undefined): DynamicModule {
    return {
      module: LoggerModule,
      imports: [LoggerCoreModule.forRoot(options)],
    };
  }

  static forRootAsync(options: LoggerModuleAsyncOptions): DynamicModule {
    return {
      module: LoggerModule,
      imports: [LoggerCoreModule.forRootAsync(options)],
    };
  }
}
