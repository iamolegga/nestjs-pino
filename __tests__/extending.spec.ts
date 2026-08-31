import { Controller, Get, Inject, Injectable } from '@nestjs/common';

import { Logger, PARAMS_PROVIDER_TOKEN, Params, PinoLogger } from '../src';

import { platforms } from './utils/platforms';
import { TestCase } from './utils/test-case';

describe('extending', () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      it('should work properly with an extended logger service', async () => {
        const msg = Math.random().toString();

        @Injectable()
        class LoggerService extends Logger {
          private readonly message: string;
          constructor(
            logger: PinoLogger,
            @Inject(PARAMS_PROVIDER_TOKEN) params: Params,
          ) {
            super(logger, params);
            this.message = msg;
          }

          log() {
            this.logger.info(this.message);
          }
        }

        @Controller('/')
        class TestController {
          constructor(private readonly logger: LoggerService) {}
          @Get('/')
          get() {
            this.logger.log();
            return {};
          }
        }

        const logs = await new TestCase(new PlatformAdapter(), {
          providers: [LoggerService],
          exports: [LoggerService],
          controllers: [TestController],
        })
          .forRoot()
          .run();

        expect(logs.some((v) => v.msg === msg)).toBeTruthy();
      });

      it('should work properly with an extended PinoLogger service', async () => {
        const msg = Math.random().toString();

        @Injectable()
        class LoggerService extends PinoLogger {
          private readonly message: string;
          constructor(@Inject(PARAMS_PROVIDER_TOKEN) params: Params) {
            super(params);
            this.message = msg;
          }

          log() {
            this.info(this.message);
          }
        }

        @Controller('/')
        class TestController {
          constructor(private readonly logger: LoggerService) {}
          @Get('/')
          get() {
            this.logger.log();
            return {};
          }
        }

        const logs = await new TestCase(new PlatformAdapter(), {
          providers: [LoggerService],
          exports: [LoggerService],
          controllers: [TestController],
        })
          .forRoot()
          .run();

        expect(logs.some((v) => v.msg === msg)).toBeTruthy();
      });
    });
  }
});
