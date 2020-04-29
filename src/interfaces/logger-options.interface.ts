import { DestinationStream } from 'pino';
import * as pinoHttp from 'pino-http';

import { MiddlewareConfigProxy } from '@nestjs/common/interfaces';

export interface LoggerOptions {
  pinoHttp?:
    | pinoHttp.Options
    | DestinationStream
    | [pinoHttp.Options, DestinationStream];
  exclude?: Parameters<MiddlewareConfigProxy['exclude']>;
  forRoutes?: Parameters<MiddlewareConfigProxy['forRoutes']>;
  useExisting?: true;
  renameContext?: string;
}

// TODO For backwards compatibility. Remove in a major release
// tslint:disable-next-line: no-empty-interface
export interface Params extends LoggerOptions {}
