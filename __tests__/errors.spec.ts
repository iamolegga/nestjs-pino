import { Controller, Get, Logger } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from '../src';

import { platforms } from './utils/platforms';
import { TestCase } from './utils/test-case';

describe('error logging', () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      describe('passing error directly', () => {
        it(InjectPinoLogger.name, async () => {
          const ctx = Math.random().toString();

          @Controller('/')
          class TestController {
            constructor(
              @InjectPinoLogger(ctx) private readonly logger: PinoLogger,
            ) {}
            @Get()
            get() {
              this.logger.info(new Error('direct error passing'));
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .forRoot()
            .run();
          expect(
            logs.some((v) => v.req && v.context === ctx && v.err),
          ).toBeTruthy();
        });

        it(PinoLogger.name, async () => {
          const ctx = Math.random().toString();

          @Controller('/')
          class TestController {
            constructor(private readonly logger: PinoLogger) {
              this.logger.setContext(ctx);
            }

            @Get()
            get() {
              this.logger.info(new Error('direct error passing'));
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .forRoot()
            .run();
          expect(
            logs.some((v) => v.req && v.context === ctx && v.err),
          ).toBeTruthy();
        });

        it(Logger.name, async () => {
          const ctx = Math.random().toString();

          @Controller('/')
          class TestController {
            private readonly logger = new Logger(ctx);
            @Get()
            get() {
              this.logger.log(new Error('direct error passing'));
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .forRoot()
            .run();
          expect(
            logs.some((v) => v.req && v.context === ctx && v.err),
          ).toBeTruthy();
        });
      });

      describe('passing error with `err` field', () => {
        it(InjectPinoLogger.name, async () => {
          const ctx = Math.random().toString();

          @Controller('/')
          class TestController {
            constructor(
              @InjectPinoLogger(ctx) private readonly logger: PinoLogger,
            ) {}
            @Get()
            get() {
              this.logger.info(
                { err: new Error('pino-style error passing'), foo: 'bar' },
                'baz',
              );
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .forRoot()
            .run();
          expect(
            logs.some(
              (v) => v.req && v.context === ctx && v.err && v.foo === 'bar',
            ),
          ).toBeTruthy();
        });

        it(PinoLogger.name, async () => {
          const ctx = Math.random().toString();

          @Controller('/')
          class TestController {
            constructor(private readonly logger: PinoLogger) {
              this.logger.setContext(ctx);
            }

            @Get()
            get() {
              this.logger.info(
                { err: new Error('pino-style error passing'), foo: 'bar' },
                'baz',
              );
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .forRoot()
            .run();
          expect(
            logs.some(
              (v) => v.req && v.context === ctx && v.err && v.foo === 'bar',
            ),
          ).toBeTruthy();
        });

        it(Logger.name, async () => {
          const ctx = Math.random().toString();

          @Controller('/')
          class TestController {
            private readonly logger = new Logger(ctx);
            @Get()
            get() {
              this.logger.log(
                { err: new Error('pino-style error passing'), foo: 'bar' },
                'baz',
              );
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .forRoot()
            .run();
          expect(
            logs.some(
              (v) => v.req && v.context === ctx && v.err && v.foo === 'bar',
            ),
          ).toBeTruthy();
        });
      });

      describe('setting custom attribute keys', () => {
        it('setting the `err` custom attribute key', async () => {
          const ctx = Math.random().toString();
          const message = 'custom `err` attribute key';

          @Controller('/')
          class TestController {
            constructor(private readonly logger: PinoLogger) {
              this.logger.setContext(ctx);
            }

            @Get()
            get() {
              this.logger.info(new Error(message), 'baz');
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .forRoot({ pinoHttp: { customAttributeKeys: { err: 'error' } } })
            .run();
          expect(
            logs.some(
              (v) =>
                v.req &&
                v.context === ctx &&
                !v.err &&
                v.error &&
                (v.error as { message: string }).message === message,
            ),
          ).toBeTruthy();
        });

        it('setting the `req` custom attribute key', async () => {
          const ctx = Math.random().toString();
          const message = 'custom `req` attribute key';

          @Controller('/')
          class TestController {
            constructor(private readonly logger: PinoLogger) {
              this.logger.setContext(ctx);
            }

            @Get()
            get() {
              this.logger.info(new Error(message), 'baz');
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .forRoot({ pinoHttp: { customAttributeKeys: { req: 'request' } } })
            .run();
          expect(
            logs.some(
              (v) =>
                !v.req &&
                v.request &&
                v.context === ctx &&
                v.err &&
                v.err.message === message,
            ),
          ).toBeTruthy();
        });
      });

      describe('keeps stack of thrown error', () => {
        it('built-in error handler logs with correct stack', async () => {
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
            .forRoot()
            .expectError(500)
            .run();

          expect(
            logs.some(
              (v) =>
                v.req &&
                v.msg === msg &&
                v.err &&
                v.err.message === msg &&
                v.err.stack.includes(__filename) &&
                v.err.stack.includes(
                  `${TestController.name}.${TestController.prototype.get.name}`,
                ),
            ),
          ).toBeTruthy();
        });
      });
    });
  }
});
