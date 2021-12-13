/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { AbstractHttpAdapter, NestFactory } from '@nestjs/core';
import { Module, ModuleMetadata, Type } from '@nestjs/common';
import MemoryStream = require('memorystream');
import * as request from 'supertest';
import { Options } from 'pino-http';
import pino from 'pino';
import {
  Logger,
  LoggerModule,
  LoggerModuleAsyncParams,
  Params,
} from '../../src';
import { __resetOutOfContextForTests as __resetSingletons } from '../../src/PinoLogger';
import { LogsContainer } from './logs';

export class TestCase {
  private module?: Type<any>;
  private stream: pino.DestinationStream;
  private expectedCode = 200;

  constructor(
    private readonly adapter: AbstractHttpAdapter<any, any, any>,
    private readonly moduleMetadata: ModuleMetadata,
  ) {
    // @ts-ignore bad typings
    this.stream = new MemoryStream('', { readable: false });
  }

  forRoot(params?: Params | undefined, skipStreamInjection = false): this {
    let finalParams: Params | undefined = params;

    if (!skipStreamInjection) {
      finalParams = this.injectStream(params);
    }

    @Module({
      ...this.moduleMetadata,
      imports: [
        LoggerModule.forRoot(finalParams),
        ...(this.moduleMetadata.imports || []),
      ],
    })
    class TestModule {}
    this.module = TestModule;

    return this;
  }

  forRootAsync(
    asyncParams: LoggerModuleAsyncParams,
    skipStreamInjection = false,
  ): this {
    if (!skipStreamInjection) {
      const useFactoryOld = asyncParams.useFactory;
      asyncParams.useFactory = (...args: any[]) => {
        const params = useFactoryOld(...args);
        if ('then' in params) {
          return params.then((p) => this.injectStream(p));
        }
        return this.injectStream(params);
      };
    }

    @Module({
      ...this.moduleMetadata,
      imports: [
        ...(this.moduleMetadata.imports || []),
        LoggerModule.forRootAsync(asyncParams),
      ],
    })
    class TestModule {}
    this.module = TestModule;

    return this;
  }

  expectError(code: number): this {
    this.expectedCode = code;
    return this;
  }

  async run(...paths: string[]): Promise<LogsContainer> {
    if (paths.length === 0) {
      paths = ['/'];
    }
    expect(this.module).toBeTruthy();

    __resetSingletons();

    const app = await NestFactory.create(this.module, this.adapter, {
      bufferLogs: true,
    });
    app.useLogger(app.get(Logger));

    const server = await app.listen(3000);
    for (const path of paths) {
      await request(server).get(path).expect(this.expectedCode);
    }
    await app.close();

    return LogsContainer.from(this.stream);
  }

  private injectStream(params: Params | undefined): Params {
    switch (true) {
      case !params:
        return { pinoHttp: this.stream };
      case !!params!.useExisting:
        return params!;
      case Array.isArray(params!.pinoHttp):
        return {
          ...params,
          pinoHttp: [
            (params!.pinoHttp as [Options, pino.DestinationStream])[0],
            this.stream,
          ],
        };
      case !!params!.pinoHttp:
        return {
          ...params,
          pinoHttp: {
            ...(params!.pinoHttp as Options),
            stream: this.stream,
          },
        };
      default:
        return {
          ...params,
          pinoHttp: this.stream,
        };
    }
  }
}
