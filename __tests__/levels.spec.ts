import * as pino from 'pino';
import * as request from 'supertest';

import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { Logger, LoggerModule } from '../src';
import { __resetOutOfContextForTests, PinoLogger } from '../src/services';
import { fastifyExtraWait } from './utils/fastifyExtraWait';
import { parseLogs } from './utils/logs';
import { platforms } from './utils/platforms';

import MemoryStream = require('memorystream');
const loggerMethods: [keyof Logger, pino.Level][] = [
  ['verbose', 'trace'],
  ['debug', 'debug'],
  ['log', 'info'],
  ['warn', 'warn'],
  ['error', 'error'],
];

const pinoLoggerMethods: pino.Level[] = loggerMethods
  .map((p) => p[1])
  .concat('fatal');

// tslint:disable: max-classes-per-file
describe(`${Logger.name} levels`, () => {
  beforeEach(() => __resetOutOfContextForTests());

  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      for (const [loggerMethodName, pinoLevel] of loggerMethods) {
        it(loggerMethodName, async () => {
          const stream = new MemoryStream();
          const serviceLogMessage = Math.random().toString();
          const appLogMessage = 'Nest application successfully started';
          let logs = '';
          const trace = 'trace';

          stream.on('data', (chunk: string) => {
            logs += chunk.toString();
          });

          @Injectable()
          class TestService {
            constructor(private readonly logger: Logger) {}
            someMethod() {
              if (loggerMethodName === 'error') {
                this.logger[loggerMethodName](
                  serviceLogMessage,
                  trace,
                  TestService.name,
                );
                this.logger[loggerMethodName](serviceLogMessage, trace);
              } else {
                this.logger[loggerMethodName](
                  serviceLogMessage,
                  TestService.name,
                );
              }
              this.logger[loggerMethodName](serviceLogMessage);
            }
          }

          @Controller('/')
          class TestController {
            constructor(private readonly service: TestService) {}
            @Get()
            get() {
              this.service.someMethod();
              return {};
            }
          }

          @Module({
            imports: [
              LoggerModule.forRoot({
                pinoHttp: [{ level: pinoLevel }, stream],
              }),
            ],
            controllers: [TestController],
            providers: [TestService],
          })
          class TestModule {}

          const app = await NestFactory.create(
            TestModule,
            new PlatformAdapter(),
            { logger: false },
          );
          app.useLogger(app.get(Logger));
          const server = app.getHttpServer();

          await app.init();
          await fastifyExtraWait(PlatformAdapter, app);

          await request(server).get('/');

          await app.close();

          const parsedLogs = parseLogs(logs);

          const serviceLogObject = parsedLogs.find(
            (v) =>
              v.msg === serviceLogMessage && v.req && !v.context && !v.trace,
          );
          expect(serviceLogObject).toBeTruthy();

          if (pinoLevel === 'error') {
            const serviceLogObjectWithTrace = parsedLogs.find(
              (v) =>
                v.msg === serviceLogMessage && v.req && !v.context && v.trace,
            );
            expect(serviceLogObjectWithTrace).toBeTruthy();
            const serviceLogObjectWithTraceAndCtx = parsedLogs.find(
              (v) =>
                v.msg === serviceLogMessage && v.req && v.context && v.trace,
            );
            expect(serviceLogObjectWithTraceAndCtx).toBeTruthy();
          } else {
            const serviceLogObjectWithContext = parsedLogs.find(
              (v) =>
                v.msg === serviceLogMessage && v.req && v.context && !v.trace,
            );
            expect(serviceLogObjectWithContext).toBeTruthy();
          }

          const responseLogObject = parsedLogs.find(
            (log) => log.msg === 'request completed',
          );

          // Because of nest itself logs and response logs has level "info"
          // they are not always exists
          const appLogObject = parsedLogs.find((log) =>
            log.msg.startsWith(appLogMessage),
          );
          if (pinoLevel === 'warn' || pinoLevel === 'error') {
            expect(appLogObject).toBeFalsy();
            expect(responseLogObject).toBeFalsy();
          } else {
            expect(appLogObject).toBeTruthy();
            expect(responseLogObject).toBeTruthy();
          }
        });
      }
    });
  }
});

describe(`${PinoLogger.name} levels`, () => {
  beforeEach(() => __resetOutOfContextForTests());

  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      // add fatal method
      for (const pinoLevel of pinoLoggerMethods) {
        it(pinoLevel, async () => {
          const stream = new MemoryStream();
          const serviceLogMessage = Math.random().toString();
          let logs = '';
          const trace = 'trace';

          stream.on('data', (chunk: string) => {
            logs += chunk.toString();
          });

          @Injectable()
          class TestService {
            constructor(private readonly logger: PinoLogger) {}
            someMethod() {
              this.logger[pinoLevel](serviceLogMessage);
            }
          }

          @Controller('/')
          class TestController {
            constructor(private readonly service: TestService) {}
            @Get()
            get() {
              this.service.someMethod();
              return {};
            }
          }

          @Module({
            imports: [
              LoggerModule.forRoot({
                pinoHttp: [{ level: pinoLevel }, stream],
              }),
            ],
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
            (v) => v.msg === serviceLogMessage,
          );
          expect(serviceLogObject).toBeTruthy();

          const responseLogObject = parsedLogs.find(
            (log) => log.msg === 'request completed',
          );

          // Because of response logs has level "info"
          // they are not always exists
          if (
            pinoLevel === 'warn' ||
            pinoLevel === 'error' ||
            pinoLevel === 'fatal'
          ) {
            expect(responseLogObject).toBeFalsy();
          } else {
            expect(responseLogObject).toBeTruthy();
          }
        });
      }
    });
  }
});
