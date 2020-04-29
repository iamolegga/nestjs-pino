import { DynamicModule, Module } from '@nestjs/common';

import { LoggerCoreModule } from './logger-core.module';
import { LoggerModuleAsyncParams, Params } from './params';

@Module({})
export class LoggerModule {
  static forRoot(params?: Params | undefined): DynamicModule {
    return {
      module: LoggerModule,
      imports: [LoggerCoreModule.forRoot(params)],
    };
  }

  static forRootAsync(params: LoggerModuleAsyncParams): DynamicModule {
    return {
      module: LoggerModule,
      imports: [LoggerCoreModule.forRootAsync(params)],
    };
  }
}
