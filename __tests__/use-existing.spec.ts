import {
  Controller,
  Get,
  Injectable,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import MemoryStream = require('memorystream');
import pino from 'pino';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { TestCase } from './utils/test-case';
import { LogsContainer } from './utils/logs';
import { platforms } from './utils/platforms';

describe('useExisting property', () => {
  describe(FastifyAdapter.name, () => {
    it('should use adapter logger in req context and default beyond', async () => {
      // @ts-ignore bad types
      const stream = new MemoryStream('', { readable: false });
      const inReqContextMsg = Math.random().toString();
      const outReqContextMsg = Math.random().toString();

      @Injectable()
      class TestService implements OnModuleInit {
        private readonly logger = new Logger(TestService.name);

        someMethod() {
          this.logger.log(inReqContextMsg);
        }
        onModuleInit() {
          this.logger.log(outReqContextMsg);
        }
      }

      @Controller('/')
      class TestController {
        constructor(private readonly service: TestService) {}
        @Get('/')
        get() {
          this.service.someMethod();
          return {};
        }
      }

      await new TestCase(new FastifyAdapter({ logger: pino(stream) }), {
        controllers: [TestController],
        providers: [TestService],
      })
        .forRoot({ useExisting: true })
        .run();

      // In this case we are checking custom stream, that was passed to pino
      // via FastifyAdapter.
      const logs = LogsContainer.from(stream);

      // existing stream is used for logs in request context
      expect(logs.some((v) => v.msg === inReqContextMsg)).toBeTruthy();
      // out of context log will be sent to stdout because of standard config
      expect(logs.some((v) => v.msg === outReqContextMsg)).toBeFalsy();
    });
  });
});

describe('pass existing pino instance', () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      it('should use passed instance out of context', async () => {
        // @ts-ignore bad types
        const stream = new MemoryStream('', { readable: false });
        const msg = Math.random().toString();

        @Injectable()
        class TestService implements OnModuleInit {
          private readonly logger = new Logger(TestService.name);
          onModuleInit() {
            this.logger.log(msg);
          }
        }

        @Controller('/')
        class TestController {
          @Get('/')
          get() {
            return {};
          }
        }

        const instance = pino(stream);

        await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
          providers: [TestService],
        })
          .forRoot({ pinoHttp: { logger: instance } }, true)
          .run();

        const logs = LogsContainer.from(stream);
        expect(logs.some((v) => v.msg === msg)).toBeTruthy();
      });
    });
  }
});
