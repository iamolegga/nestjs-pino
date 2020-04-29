import * as request from 'supertest';

import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { InjectPinoLogger, Logger, LoggerModule, PinoLogger } from '../src';
import { __resetOutOfContextForTests } from '../src/services';
import { fastifyExtraWait } from './utils/fastifyExtraWait';
import { parseLogs } from './utils/logs';
import { platforms } from './utils/platforms';

import MemoryStream = require('memorystream');
describe('rename context property', () => {
  beforeEach(() => __resetOutOfContextForTests());

  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      it('should work', async () => {
        const stream = new MemoryStream();
        const serviceLogMessage = Math.random().toString();
        const controllerLogMessage = Math.random().toString();
        const serviceContext = Math.random().toString();
        const controllerContext = Math.random().toString();
        const renameContext = 'ctx';
        let logs = '';

        stream.on('data', (chunk: string) => {
          logs += chunk.toString();
        });

        @Injectable()
        class TestService {
          constructor(private readonly logger: Logger) {}
          someMethod() {
            this.logger.log(serviceLogMessage, serviceContext);
          }
        }

        @Controller('/')
        class TestController {
          constructor(
            private readonly service: TestService,
            @InjectPinoLogger(controllerContext)
            private readonly logger: PinoLogger,
          ) {}
          @Get()
          get() {
            this.logger.info({ foo: 'bar' }, controllerLogMessage);
            this.logger.info(controllerLogMessage);
            this.service.someMethod();
            return {};
          }
        }

        @Module({
          imports: [LoggerModule.forRoot({ pinoHttp: stream, renameContext })],
          controllers: [TestController],
          providers: [TestService],
        })
        class TestModule {}

        const app = await NestFactory.create(
          TestModule,
          new PlatformAdapter(),
          { logger: false },
        );
        const server = app.getHttpServer();

        await app.init();
        await fastifyExtraWait(PlatformAdapter, app);

        await request(server).get('/');

        await app.close();

        const parsedLogs = parseLogs(logs);

        const serviceLogObject = parsedLogs.find(
          (v) =>
            v.msg === serviceLogMessage &&
            v.req &&
            v[renameContext] === serviceContext,
        );
        expect(serviceLogObject).toBeTruthy();

        const controllerLogObject1 = parsedLogs.find(
          (v) =>
            v.msg === controllerLogMessage &&
            v.req &&
            v[renameContext] === controllerContext &&
            (v as any).foo === 'bar',
        );
        const controllerLogObject2 = parsedLogs.find(
          (v) =>
            v.msg === controllerLogMessage &&
            v.req &&
            v[renameContext] === controllerContext &&
            !('foo' in v),
        );
        expect(controllerLogObject1).toBeTruthy();
        expect(controllerLogObject2).toBeTruthy();
      });
    });
  }
});
