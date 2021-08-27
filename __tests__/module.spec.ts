import { Module, Controller, Get, Injectable, Logger } from '@nestjs/common';
import MemoryStream = require('memorystream');
import { LoggerModule } from '../src';
import { platforms } from './utils/platforms';
import { LogsContainer } from './utils/logs';
import { TestCase } from './utils/test-case';

describe('module initialization', () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      describe('forRoot', () => {
        it('should work properly without params', async () => {
          @Controller('/')
          class TestController {
            private readonly logger = new Logger(TestController.name);

            @Get('/')
            get() {
              this.logger.log('');
              return {};
            }
          }

          await new TestCase(new PlatformAdapter(), {
            imports: [LoggerModule.forRoot()],
            controllers: [TestController],
          })
            .forRoot(undefined, true)
            .run();
        });

        it('should work properly with single value of `httpPino` property', async () => {
          const msg = Math.random().toString();

          @Controller('/')
          class TestController {
            private readonly logger = new Logger(TestController.name);
            @Get('/')
            get() {
              this.logger.log(msg);
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .forRoot({ pinoHttp: { level: 'info' } })
            .run();

          expect(logs.some((v) => v.msg === msg)).toBeTruthy();
        });

        it('should work properly with array as value of `httpPino` property', async () => {
          // @ts-ignore bad types
          const stream = new MemoryStream('', { readable: false });
          const msg = Math.random().toString();

          @Controller('/')
          class TestController {
            private readonly logger = new Logger(TestController.name);
            @Get('/')
            get() {
              this.logger.log(msg);
              return {};
            }
          }

          await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .forRoot({ pinoHttp: [{ level: 'info' }, stream] }, true)
            .run();

          const logs = LogsContainer.from(stream);
          expect(logs.some((v) => v.msg === msg)).toBeTruthy();
        });
      });

      describe('forRootAsync', () => {
        it('should work properly when useFactory returns single value of `httpPino` property', async () => {
          const msg = Math.random().toString();

          @Controller('/')
          class TestController {
            private readonly logger = new Logger(TestController.name);
            @Get('/')
            get() {
              this.logger.log(msg);
              return {};
            }
          }

          @Injectable()
          class Config {
            readonly level = 'info';
          }

          @Module({
            providers: [Config],
            exports: [Config],
          })
          class ConfigModule {}

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .forRootAsync({
              imports: [ConfigModule],
              inject: [Config],
              useFactory: (cfg: Config) => {
                return { pinoHttp: { level: cfg.level } };
              },
            })
            .run();

          expect(logs.some((v) => v.msg === msg)).toBeTruthy();
        });

        it('should work properly when useFactory returns array as value of `httpPino` property', async () => {
          // @ts-ignore bad types
          const stream = new MemoryStream('', { readable: false });
          const msg = Math.random().toString();

          @Controller('/')
          class TestController {
            private readonly logger = new Logger(TestController.name);
            @Get('/')
            get() {
              this.logger.log(msg);
              return {};
            }
          }

          @Injectable()
          class Config {
            readonly level = 'info';
          }

          @Module({
            providers: [Config],
            exports: [Config],
          })
          class ConfigModule {}

          await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .forRootAsync(
              {
                imports: [ConfigModule],
                inject: [Config],
                useFactory: (cfg: Config) => {
                  return { pinoHttp: [{ level: cfg.level }, stream] };
                },
              },
              true,
            )
            .run();

          const logs = LogsContainer.from(stream);
          expect(logs.some((v) => v.msg === msg)).toBeTruthy();
        });

        it('should work properly when pass deps via providers', async () => {
          const msg = Math.random().toString();

          @Controller('/')
          class TestController {
            private readonly logger = new Logger(TestController.name);
            @Get('/')
            get() {
              this.logger.log(msg);
              return {};
            }
          }

          @Injectable()
          class Config {
            readonly level = 'info';
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .forRootAsync({
              providers: [Config],
              inject: [Config],
              useFactory: (cfg: Config) => {
                return { pinoHttp: { level: cfg.level } };
              },
            })
            .run();

          expect(logs.some((v) => v.msg === msg)).toBeTruthy();
        });

        it('should work properly when useFactory returns Promise', async () => {
          const msg = Math.random().toString();

          @Controller('/')
          class TestController {
            private readonly logger = new Logger(TestController.name);
            @Get('/')
            get() {
              this.logger.log(msg);
              return {};
            }
          }

          const logs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .forRootAsync({
              useFactory: async () => {
                return { pinoHttp: { level: 'info' } };
              },
            })
            .run();

          expect(logs.some((v) => v.msg === msg)).toBeTruthy();
        });
      });
    });
  }
});
