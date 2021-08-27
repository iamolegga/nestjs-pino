import { Controller, Get } from '@nestjs/common';
import { PinoLogger } from '../src';
import { platforms } from './utils/platforms';
import { TestCase } from './utils/test-case';

describe('getting the logger instance', () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      it('logger is publicly accessible', async () => {
        @Controller('/')
        class TestController {
          constructor(private readonly logger: PinoLogger) {}
          @Get()
          get() {
            expect(this.logger.logger.constructor.name).toEqual('Pino');
          }
        }

        await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
        })
          .forRoot()
          .run();
      });
    });
  }
});
