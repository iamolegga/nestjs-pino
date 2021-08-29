import { Controller, Get } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { PinoLogger } from '../src';
import { platforms } from './utils/platforms';
import { TestCase } from './utils/test-case';

describe('runtime update', () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      it('works', async () => {
        const msg1 = Math.random().toString();
        const msg2 = Math.random().toString();
        const messages = [msg1, msg2];
        let msgIdx = 0;

        const pathCheck = '/log-with-level-info';
        const pathSetLevel = '/set-level-info';

        @Controller('/')
        class TestController {
          constructor(private readonly logger: PinoLogger) {}

          @Get(pathCheck)
          check() {
            this.logger.info(messages[msgIdx++]);
            return {};
          }

          @Get(pathSetLevel)
          setLevel() {
            PinoLogger.root.level = 'info';
            return {};
          }
        }

        const logs = await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
        })
          .forRoot({ pinoHttp: { level: 'silent' } })
          .run(pathCheck, pathSetLevel, pathCheck);

        expect(logs.some((l) => l.msg === msg1)).toBeFalsy();
        expect(logs.some((l) => l.msg === msg2)).toBeTruthy();
      });
    });
  }

  it("doesn't work with useExisting", async () => {
    @Controller('/')
    class TestController {
      @Get()
      setLevel() {
        expect(PinoLogger.root).toBeUndefined();
        return {};
      }
    }

    await new TestCase(new FastifyAdapter(), {
      controllers: [TestController],
    })
      .forRoot({ useExisting: true })
      .run();
  });
});
