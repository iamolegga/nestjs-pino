import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get, Injectable } from '@nestjs/common';
import MemoryStream = require('memorystream');
import * as request from 'supertest';
import * as pino from 'pino';
import { Logger, LoggerModule } from '../src';
import { platforms } from './utils/platforms';
import { fastifyExtraWait } from './utils/fastifyExtraWait';
import { parseLogs } from './utils/logs';
import { __resetOutOfContextForTests } from '../src/PinoLogger';

describe('pass existing logger', () => {
  beforeEach(() => __resetOutOfContextForTests());

  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      it('should be used by app and by service', async () => {
        const stream = new MemoryStream();
        const random = Math.random().toString();
        let logs = '';

        stream.on('data', (chunk: string) => {
          logs += chunk.toString();
        });

        @Injectable()
        class TestService {
          constructor(private readonly logger: Logger) {}
          someMethod() {
            this.logger.log(random);
          }
        }

        @Controller('/')
        class TestController {
          constructor(private readonly service: TestService) {}
          @Get('/')
          get() {
            this.service.someMethod();
            return {};
          }
        }

        @Module({
          imports: [
            LoggerModule.forRoot({ pinoHttp: { logger: pino(stream) } })
          ],
          controllers: [TestController],
          providers: [TestService]
        })
        class TestModule {}

        const app = await NestFactory.create(
          TestModule,
          new PlatformAdapter(),
          { logger: false }
        );
        app.useLogger(app.get(Logger));
        const server = app.getHttpServer();

        await app.init();
        await fastifyExtraWait(PlatformAdapter, app);
        await request(server).get('/');
        await app.close();

        const parsedLogs = parseLogs(logs);

        const serviceLogObject = parsedLogs.find(v => v.msg === random);
        expect(serviceLogObject).toBeTruthy();

        const appLogObject = parsedLogs.find(log =>
          log.msg.startsWith('Nest application successfully started')
        );
        expect(appLogObject).toBeTruthy();
      });
    });
  }
});
