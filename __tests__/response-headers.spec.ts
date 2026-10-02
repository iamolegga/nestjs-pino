import { Controller, Get, Header, Res } from '@nestjs/common';

import { platforms } from './utils/platforms';
import { TestCase } from './utils/test-case';

/** The part both `express.Response` and fastify's `Reply` implement. */
type ResponseWithHeader = { header(name: string, value: string[]): unknown };

describe('response headers', () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      it('are logged', async () => {
        @Controller('/')
        class TestController {
          @Get()
          @Header('x-custom', 'yes')
          get() {
            return {};
          }
        }

        const logs = await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
        })
          .forRoot()
          .run();

        const res = logs.getResponseLog()?.res as {
          headers: Record<string, unknown>;
        };

        expect(res.headers['x-custom']).toBe('yes');
        expect(res.headers['content-type']).toMatch(/application\/json/);
        expect(res.headers['content-length']).toBeDefined();
      });

      it('are logged when a single name carries several values', async () => {
        @Controller('/')
        class TestController {
          @Get()
          get(@Res({ passthrough: true }) res: ResponseWithHeader) {
            res.header('set-cookie', ['foo=1', 'bar=2']);
            return {};
          }
        }

        const logs = await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
        })
          .forRoot()
          .run();

        const res = logs.getResponseLog()?.res as {
          headers: Record<string, unknown>;
        };

        expect(res.headers['set-cookie']).toEqual(['foo=1', 'bar=2']);
      });
    });
  }
});
