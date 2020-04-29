import { ModuleMetadata, Type } from '@nestjs/common/interfaces';

import { LoggerOptionsFactory } from './logger-options-factory.interface';
import { LoggerOptions } from './logger-options.interface';

export interface LoggerModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports' | 'providers'> {
  inject?: any[];
  useExisting?: Type<LoggerOptionsFactory>;
  useClass?: Type<LoggerOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<LoggerOptions> | LoggerOptions;
}

// TODO For backwards compatibility. Remove in a major release
// tslint:disable-next-line: no-empty-interface
export interface LoggerModuleAsyncParams extends LoggerModuleAsyncOptions {}
