import {
  Controller,
  Get,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';

import { PinoLogger } from '../src';

import { platforms } from './utils/platforms';
import { TestCase } from './utils/test-case';

describe('assign', () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      it('in request context', async () => {
        const msg = Math.random().toString();

        @Injectable()
        class TestService {
          private readonly logger = new Logger(TestService.name);

          test() {
            this.logger.log(msg);
            return {};
          }
        }

        @Controller('/')
        class TestController {
          constructor(
            private readonly logger: PinoLogger,
            private readonly service: TestService,
          ) {}

          @Get()
          get() {
            this.logger.assign({ foo: 'bar' });
            return this.service.test();
          }
        }

        const logs = await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
          providers: [TestService],
        })
          .forRoot({ pinoHttp: { customSuccessMessage: () => 'success' } })
          .run();

        const wanted = logs.some((l) => l.msg === msg && l.foo === 'bar');
        expect(wanted).toBeTruthy();
        const responseLog = logs.find((l) => l.msg === 'success');
        expect(responseLog).toBeDefined();
        expect(responseLog).not.toHaveProperty('foo');
      });

      it('out of request context', async () => {
        const msg = Math.random().toString();

        @Injectable()
        class TestService implements OnModuleInit {
          constructor(private readonly logger: PinoLogger) {
            logger.setContext(TestService.name);
          }

          onModuleInit() {
            expect(() => this.logger.assign({ foo: 'bar' })).toThrow();
          }

          test() {
            this.logger.info(msg);
            return {};
          }
        }

        @Controller('/')
        class TestController {
          constructor(private readonly service: TestService) {}

          @Get()
          get() {
            return this.service.test();
          }
        }

        const logs = await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
          providers: [TestService],
        })
          .forRoot()
          .run();

        const log = logs.find((l) => l.msg === msg);
        expect(log).toBeTruthy();
        expect(log).not.toHaveProperty('foo');
      });

      it('response log', async () => {
        const msg = Math.random().toString();

        @Injectable()
        class TestService {
          private readonly logger = new Logger(TestService.name);

          test() {
            this.logger.log(msg);
            return {};
          }
        }

        @Controller('/')
        class TestController {
          constructor(
            private readonly logger: PinoLogger,
            private readonly service: TestService,
          ) {}

          @Get()
          get() {
            this.logger.assign({ foo: 'bar' });
            this.logger.assign({ other: 'value' });
            return this.service.test();
          }
        }

        const logs = await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
          providers: [TestService],
        })
          .forRoot({
            assignResponse: true,
            pinoHttp: { customSuccessMessage: () => 'success' },
          })
          .run();

        const hasServiceLog = logs.some(
          (l) => l.msg === msg && l.foo === 'bar' && l.other === 'value',
        );
        expect(hasServiceLog).toBeTruthy();
        const hasResponseLog = logs.some(
          (l) => l.msg === 'success' && l.foo === 'bar' && l.other === 'value',
        );
        expect(hasResponseLog).toBeTruthy();
      });
    });
  }
});
