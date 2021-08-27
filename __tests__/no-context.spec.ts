import { Controller, Get, Logger } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from '../src';
import { platforms } from './utils/platforms';
import { TestCase } from './utils/test-case';

describe('no context', () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      it(Logger.name, async () => {
        const msg = Math.random().toString();

        @Controller('/')
        class TestController {
          private readonly logger = new Logger();

          @Get()
          get() {
            this.logger.log(msg);
            return {};
          }
        }

        const logs = await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
        })
          .forRoot()
          .run();

        const ctrlLog = logs.find((v) => v.msg === msg);
        expect(ctrlLog).toBeTruthy();
        expect(ctrlLog).not.toHaveProperty('context');
      });

      it(PinoLogger.name, async () => {
        const msg = Math.random().toString();

        @Controller('/')
        class TestController {
          constructor(
            @InjectPinoLogger() private readonly logger: PinoLogger,
          ) {}

          @Get()
          get() {
            this.logger.info(msg);
            return {};
          }
        }

        const logs = await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
        })
          .forRoot()
          .run();

        const ctrlLog = logs.find((v) => v.msg === msg);
        expect(ctrlLog).toBeTruthy();
        expect(ctrlLog).not.toHaveProperty('context');
      });
    });
  }
});
