import { Controller, Get, Logger } from '@nestjs/common';
import pino from 'pino';
import { PinoLogger } from '../src';
import { platforms } from './utils/platforms';
import { TestCase } from './utils/test-case';

const loggerMethods: [Exclude<keyof Logger, 'localInstance'>, pino.Level][] = [
  ['verbose', 'trace'],
  ['debug', 'debug'],
  ['log', 'info'],
  ['warn', 'warn'],
  ['error', 'error'],
];

const pinoLoggerMethods: pino.Level[] = loggerMethods
  .map((p) => p[1])
  .concat('fatal');

describe(`Logger levels`, () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      for (const [loggerMethodName, pinoLevel] of loggerMethods) {
        it(loggerMethodName, async () => {
          const controllerMsg = Math.random().toString();

          @Controller('/')
          class TestController {
            private readonly logger = new Logger(TestController.name);
            @Get()
            get() {
              this.logger[loggerMethodName](controllerMsg);
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .forRoot({ pinoHttp: { level: pinoLevel } })
            .run();

          expect(logs.some((v) => v.msg === controllerMsg)).toBeTruthy();
          if (
            pinoLevel === 'warn' ||
            pinoLevel === 'error' ||
            pinoLevel === 'fatal'
          ) {
            expect(logs.getStartLog()).toBeFalsy();
            expect(logs.getResponseLog()).toBeFalsy();
          } else {
            expect(logs.getStartLog()).toBeTruthy();
            expect(logs.getResponseLog()).toBeTruthy();
          }
        });
      }
    });
  }
});

describe(`PinoLogger levels`, () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      // add fatal method
      for (const pinoLevel of pinoLoggerMethods) {
        it(pinoLevel, async () => {
          const controllerMsg = Math.random().toString();

          @Controller('/')
          class TestController {
            constructor(private readonly logger: PinoLogger) {}
            @Get()
            get() {
              this.logger[pinoLevel](controllerMsg);
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .forRoot({ pinoHttp: { level: pinoLevel } })
            .run();

          expect(logs.some((v) => v.msg === controllerMsg)).toBeTruthy();
          if (
            pinoLevel === 'warn' ||
            pinoLevel === 'error' ||
            pinoLevel === 'fatal'
          ) {
            expect(logs.getStartLog()).toBeFalsy();
            expect(logs.getResponseLog()).toBeFalsy();
          } else {
            expect(logs.getStartLog()).toBeTruthy();
            expect(logs.getResponseLog()).toBeTruthy();
          }
        });
      }
    });
  }
});
