import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get, RequestMethod } from '@nestjs/common';
import MemoryStream = require('memorystream');
import * as request from 'supertest';
import { Logger, LoggerModule } from '../src';
import { platforms } from './utils/platforms';
import { fastifyExtraWait } from './utils/fastifyExtraWait';
import { parseLogs } from './utils/logs';
import { __resetOutOfContextForTests } from '../src/PinoLogger';

describe('routing', () => {
  beforeEach(() => __resetOutOfContextForTests());

  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      it('routing should work properly', async () => {
        const logValue = Math.random().toString();
        const logValue2 = Math.random().toString();
        const logValue3 = Math.random().toString();

        let logs = '';
        const stream = new MemoryStream();
        stream.on('data', (chunk: string) => {
          logs += chunk.toString();
        });

        @Controller('/')
        class LoggingController {
          constructor(private readonly logger: Logger) {}
          @Get('/')
          withLog() {
            this.logger.log(logValue);
            return {};
          }

          @Get('/skip-log')
          skipLog() {
            this.logger.log(logValue2);
            return {};
          }
        }

        @Controller('/no-logging')
        class NoLoggingController {
          constructor(private readonly logger: Logger) {}
          @Get()
          get() {
            this.logger.log(logValue3);
            return {};
          }
        }

        @Module({
          imports: [
            LoggerModule.forRoot({
              pinoHttp: stream,
              forRoutes: [LoggingController],
              exclude: [{ method: RequestMethod.ALL, path: 'skip-log' }]
            })
          ],
          controllers: [LoggingController, NoLoggingController]
        })
        class TestModule {}

        const app = await NestFactory.create(
          TestModule,
          new PlatformAdapter(),
          { logger: false }
        );
        const server = app.getHttpServer();

        await app.init();
        await fastifyExtraWait(PlatformAdapter, app);

        await Promise.all([
          request(server).get('/'),
          request(server).get('/skip-log'),
          request(server).get('/no-logging')
        ]);
        await app.close();

        const parsedLogs = parseLogs(logs);

        // log object of included controller should have `req` property
        const logObject = parsedLogs.find(v => v.msg === logValue && !!v.req);
        expect(logObject).toBeTruthy();

        // log object of included controller but excluded route should not have `req` property
        const logObject2 = parsedLogs.find(v => v.msg === logValue2 && !v.req);
        expect(logObject2).toBeTruthy();

        // log object of not included controller should not have `req` property
        const logObject3 = parsedLogs.find(v => v.msg === logValue3);
        expect(logObject3).toBeTruthy();

        // should be only 1 req/res auto log
        const responseLogObjects = parsedLogs.filter(v => !!v.res);
        expect(responseLogObjects).toHaveLength(1);
      });
    });
  }
});
