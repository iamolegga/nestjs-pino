import { Controller, Get, Logger, VersioningType } from '@nestjs/common';

import { platforms } from './utils/platforms';
import { TestCase } from './utils/test-case';

// Regression test for #3219.
//
// @fastify/middie@9.3.6 prefixes a mount path that does not start with "/"
// (GHSA-5p92-8765-9fv8), so the default `{/*splat}` route became `/{/*splat}`,
// which matches "/" but not "/deep": every request to a nested path went
// unlogged on Fastify. The root path must stay covered too, hence the sibling
// tests in `global-prefix.spec.ts`.
describe('default routes', () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      let msg: string;
      let testCase: TestCase;

      beforeEach(() => {
        msg = Math.random().toString();

        @Controller('/')
        class DeepController {
          private readonly logger = new Logger(DeepController.name);

          @Get('deep')
          deep() {
            this.logger.log(msg);
            return {};
          }
        }

        testCase = new TestCase(new PlatformAdapter(), {
          controllers: [DeepController],
        }).forRoot();
      });

      it('keeps the request context on a nested path', async () => {
        const logs = await testCase.run('/deep');
        expect(logs.some((v) => v.msg === msg && !!v.req)).toBeTruthy();
      });

      it('still emits the automatic response log for a nested path', async () => {
        const logs = await testCase.run('/deep');
        expect(logs.getResponseLog()).toBeTruthy();
      });

      // The default route has to keep working under URI versioning too, where
      // NestJS also mounts it under the version segment: `/v1` and `/v1/deep`.
      describe('with URI versioning', () => {
        beforeEach(() => {
          @Controller('/')
          class VersionedController {
            private readonly logger = new Logger(VersionedController.name);

            @Get()
            root() {
              this.logger.log(msg);
              return {};
            }

            @Get('deep')
            deep() {
              this.logger.log(msg);
              return {};
            }
          }

          testCase = new TestCase(new PlatformAdapter(), {
            controllers: [VersionedController],
          })
            .setVersioning({ type: VersioningType.URI, defaultVersion: '1' })
            .forRoot();
        });

        for (const path of ['/v1', '/v1/deep']) {
          it(`keeps the request context on ${path}`, async () => {
            const logs = await testCase.run(path);
            expect(logs.some((v) => v.msg === msg && !!v.req)).toBeTruthy();
          });
        }
      });
    });
  }
});
