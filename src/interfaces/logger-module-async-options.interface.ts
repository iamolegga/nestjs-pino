import { ModuleMetadata } from '@nestjs/common/interfaces';

import { LoggerOptions } from './logger-options.interface';

export interface LoggerModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports' | 'providers'> {
  inject?: any[];
  useFactory: (...args: any[]) => LoggerOptions | Promise<LoggerOptions>;
}

// TODO For backwards compatibility. Remove in a major release
// tslint:disable-next-line: no-empty-interface
export interface LoggerModuleAsyncParams extends LoggerModuleAsyncOptions {}
