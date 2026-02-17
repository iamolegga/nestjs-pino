import {
  Controller,
  Get,
  Logger,
  ConsoleLogger,
  LogLevel,
} from '@nestjs/common';
import pino from 'pino';

import { NativeLogger, nativeLoggerOptions } from '../src';

import { platforms } from './utils/platforms';
import { TestCase } from './utils/test-case';

const loggerMethods: [LogLevel, pino.Level][] = [
  ['verbose', 'trace'],
  ['debug', 'debug'],
  ['log', 'info'],
  ['warn', 'warn'],
  ['error', 'error'],
];

if (ConsoleLogger.prototype.hasOwnProperty('fatal'))
  loggerMethods.push([<LogLevel>'fatal', 'fatal']);

// NestJS's built-in Logger always appends its constructor context as the last
// string argument when forwarding to the app-level logger (NativeLogger).
// So `new Logger('Ctx').log(msg)` calls NativeLogger.log(msg, 'Ctx').
// NativeLogger then extracts 'Ctx' as the context (last string argument).

describe('NativeLogger', () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      describe('level mapping', () => {
        for (const [loggerMethodName, pinoLevel] of loggerMethods) {
          it(`${loggerMethodName} maps to pino ${pinoLevel}`, async () => {
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
              .useLoggerClass(NativeLogger)
              .forRoot({
                pinoHttp: { ...nativeLoggerOptions, level: pinoLevel },
              })
              .run();

            expect(logs.some((v) => v.message === controllerMsg)).toBeTruthy();
          });
        }
      });

      describe('argument parsing (non-error)', () => {
        it('single string message gets context from NestJS Logger', async () => {
          const msg = Math.random().toString();

          @Controller('/')
          class TestController {
            private readonly logger = new Logger(TestController.name);
            @Get()
            get() {
              // NestJS Logger forwards as: log(msg, 'TestController')
              this.logger.log(msg);
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .useLoggerClass(NativeLogger)
            .forRoot({ pinoHttp: nativeLoggerOptions })
            .run();

          const found = logs.find(
            (v) => v.message === msg && v.context === 'TestController',
          );
          expect(found).toBeTruthy();
        });

        it('extra string arg becomes a separate message, NestJS context wins', async () => {
          const msg = Math.random().toString();
          const extra = Math.random().toString();

          @Controller('/')
          class TestController {
            private readonly logger = new Logger(TestController.name);
            @Get()
            get() {
              // NestJS Logger forwards as: log(msg, extra, 'TestController')
              // NativeLogger: context='TestController', messages=[msg, extra]
              this.logger.log(msg, extra);
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .useLoggerClass(NativeLogger)
            .forRoot({ pinoHttp: nativeLoggerOptions })
            .run();

          const msgLog = logs.find(
            (v) => v.message === msg && v.context === 'TestController',
          );
          expect(msgLog).toBeTruthy();

          const extraLog = logs.find(
            (v) => v.message === extra && v.context === 'TestController',
          );
          expect(extraLog).toBeTruthy();
        });

        it('multiple messages with object (each logged separately)', async () => {
          const msg1 = Math.random().toString();
          const msg2Key = Math.random().toString();
          const msg2Val = Math.random().toString();

          @Controller('/')
          class TestController {
            private readonly logger = new Logger(TestController.name);
            @Get()
            get() {
              // NestJS Logger forwards as: log(msg1, {key:val}, 'TestController')
              // NativeLogger: context='TestController', messages=[msg1, {key:val}]
              this.logger.log(msg1, { [msg2Key]: msg2Val });
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .useLoggerClass(NativeLogger)
            .forRoot({ pinoHttp: nativeLoggerOptions })
            .run();

          const strLog = logs.find(
            (v) => v.message === msg1 && v.context === 'TestController',
          );
          expect(strLog).toBeTruthy();

          const objLog = logs.find(
            (v) =>
              typeof v.message === 'object' &&
              (v.message as Record<string, unknown>)[msg2Key] === msg2Val &&
              v.context === 'TestController',
          );
          expect(objLog).toBeTruthy();
        });

        it('object message with NestJS context', async () => {
          const key = Math.random().toString();
          const val = Math.random().toString();

          @Controller('/')
          class TestController {
            private readonly logger = new Logger(TestController.name);
            @Get()
            get() {
              // NestJS Logger forwards as: log({key:val}, 'TestController')
              // NativeLogger: context='TestController', messages=[{key:val}]
              this.logger.log({ [key]: val });
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .useLoggerClass(NativeLogger)
            .forRoot({ pinoHttp: nativeLoggerOptions })
            .run();

          const found = logs.find(
            (v) =>
              typeof v.message === 'object' &&
              (v.message as Record<string, unknown>)[key] === val &&
              v.context === 'TestController',
          );
          expect(found).toBeTruthy();
        });

        it('Error object as message', async () => {
          const errorMsg = Math.random().toString();

          @Controller('/')
          class TestController {
            private readonly logger = new Logger(TestController.name);
            @Get()
            get() {
              // NestJS Logger forwards as: log(Error, 'TestController')
              // NativeLogger: context='TestController', messages=[Error]
              this.logger.log(new Error(errorMsg));
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .useLoggerClass(NativeLogger)
            .forRoot({ pinoHttp: nativeLoggerOptions })
            .run();

          const found = logs.find(
            (v) =>
              typeof v.message === 'string' &&
              (v.message as string).includes(errorMsg) &&
              (v.message as string).includes('at ') &&
              v.context === 'TestController',
          );
          expect(found).toBeTruthy();
          // No separate stack field — Error.stack is the message (matches ConsoleLogger)
          expect(found!.stack).toBeUndefined();
        });
      });

      describe('error method', () => {
        it('error with NestJS context only', async () => {
          const msg = Math.random().toString();

          @Controller('/')
          class TestController {
            private readonly logger = new Logger(TestController.name);
            @Get()
            get() {
              // NestJS Logger forwards as: error(msg, undefined, 'TestController')
              this.logger.error(msg);
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .useLoggerClass(NativeLogger)
            .forRoot({ pinoHttp: nativeLoggerOptions })
            .run();

          const found = logs.find(
            (v) => v.message === msg && v.context === 'TestController',
          );
          expect(found).toBeTruthy();
        });

        it('error with stack trace', async () => {
          const msg = Math.random().toString();
          const stack = `Error: ${msg}\n    at Object.<anonymous> (/test.js:1:1)`;

          @Controller('/')
          class TestController {
            private readonly logger = new Logger(TestController.name);
            @Get()
            get() {
              // NestJS Logger forwards as: error(msg, stack, 'TestController')
              // NativeLogger: context='TestController', stack=stack, messages=[msg]
              this.logger.error(msg, stack);
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .useLoggerClass(NativeLogger)
            .forRoot({ pinoHttp: nativeLoggerOptions })
            .run();

          const found = logs.find(
            (v) =>
              v.message === msg &&
              v.context === 'TestController' &&
              typeof v.stack === 'string',
          );
          expect(found).toBeTruthy();
          expect(found!.stack).toContain('at Object');
        });

        it('NestJS exception handler contract (thrown error)', async () => {
          const msg = Math.random().toString();

          @Controller('/')
          class TestController {
            @Get()
            get() {
              throw new Error(msg);
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .useLoggerClass(NativeLogger)
            .forRoot({ pinoHttp: nativeLoggerOptions })
            .expectError(500)
            .run();

          const found = logs.find(
            (v) =>
              typeof v.message === 'string' &&
              (v.message as string).includes(msg),
          );
          expect(found).toBeTruthy();
        });
      });

      describe('renameContext', () => {
        it('respects renameContext parameter', async () => {
          const msg = Math.random().toString();
          const customContextName = 'source';

          @Controller('/')
          class TestController {
            private readonly logger = new Logger(TestController.name);
            @Get()
            get() {
              this.logger.log(msg);
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .useLoggerClass(NativeLogger)
            .forRoot({
              pinoHttp: nativeLoggerOptions,
              renameContext: customContextName,
            })
            .run();

          const found = logs.find(
            (v) =>
              v.message === msg && v[customContextName] === 'TestController',
          );
          expect(found).toBeTruthy();
          expect(found!.context).toBeUndefined();
        });
      });
    });
  }
});
