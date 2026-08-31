import { Controller, Get, Logger } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from '../src';

import { platforms } from './utils/platforms';
import { TestCase } from './utils/test-case';

describe('rename context property name', () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      it(InjectPinoLogger.name, async () => {
        const ctxFiledName = 'ctx';
        const msg = Math.random().toString();

        @Controller('/')
        class TestController {
          constructor(
            @InjectPinoLogger(TestController.name)
            private readonly logger: PinoLogger,
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
          .forRoot({ renameContext: ctxFiledName })
          .run();
        expect(
          logs.some(
            (v) =>
              v.req && v[ctxFiledName] === TestController.name && v.msg === msg,
          ),
        ).toBeTruthy();
        expect(logs.getStartLog()).toHaveProperty(ctxFiledName);
      });

      it(PinoLogger.name, async () => {
        const ctxFiledName = 'ctx';
        const msg = Math.random().toString();

        @Controller('/')
        class TestController {
          constructor(private readonly logger: PinoLogger) {
            this.logger.setContext(TestController.name);
          }

          @Get()
          get() {
            this.logger.info(msg);
            return {};
          }
        }

        const logs = await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
        })
          .forRoot({ renameContext: ctxFiledName })
          .run();
        expect(
          logs.some(
            (v) =>
              v.req && v[ctxFiledName] === TestController.name && v.msg === msg,
          ),
        ).toBeTruthy();
        expect(logs.getStartLog()).toHaveProperty(ctxFiledName);
      });

      it(Logger.name, async () => {
        const ctxFiledName = 'ctx';
        const msg = Math.random().toString();

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
          .forRoot({ renameContext: ctxFiledName })
          .run();
        expect(
          logs.some(
            (v) =>
              v.req && v[ctxFiledName] === TestController.name && v.msg === msg,
          ),
        ).toBeTruthy();
        expect(logs.getStartLog()).toHaveProperty(ctxFiledName);
      });
    });
  }
});
