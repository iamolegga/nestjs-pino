import * as request from 'supertest';

import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { InjectPinoLogger, LoggerModule, PinoLogger } from '../src';
import { __resetOutOfContextForTests } from '../src/services';
import { fastifyExtraWait } from './utils/fastifyExtraWait';
import { parseLogs } from './utils/logs';
import { platforms } from './utils/platforms';

import MemoryStream = require('memorystream');
describe('InjectPinoLogger', () => {
  beforeEach(() => __resetOutOfContextForTests());

  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      it('should work', async () => {
        const stream = new MemoryStream();
        const serviceLogMessage = Math.random().toString();
        const controllerLogMessage = Math.random().toString();
        const context = Math.random().toString();
        let logs = '';

        stream.on('data', (chunk: string) => {
          logs += chunk.toString();
        });

        @Injectable()
        class TestService {
          constructor(
            @InjectPinoLogger() private readonly logger: PinoLogger,
          ) {}
          someMethod() {
            this.logger.info(serviceLogMessage);
          }
        }

        @Controller('/')
        class TestController {
          constructor(
            private readonly service: TestService,
            @InjectPinoLogger(context) private readonly logger: PinoLogger,
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
          imports: [LoggerModule.forRoot({ pinoHttp: stream })],
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
          (v) => v.msg === serviceLogMessage && v.req && !v.context,
        );
        expect(serviceLogObject).toBeTruthy();

        const controllerLogObject1 = parsedLogs.find(
          (v) =>
            v.msg === controllerLogMessage &&
            v.req &&
            v.context === context &&
            (v as any).foo === 'bar',
        );
        const controllerLogObject2 = parsedLogs.find(
          (v) =>
            v.msg === controllerLogMessage &&
            v.req &&
            v.context === context &&
            !('foo' in v),
        );
        expect(controllerLogObject1).toBeTruthy();
        expect(controllerLogObject2).toBeTruthy();
      });
    });
  }
});
