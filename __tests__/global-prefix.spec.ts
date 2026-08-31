import { readFileSync } from 'node:fs';

import { Controller, Get, Logger } from '@nestjs/common';
import pino from 'pino';

import { platforms } from './utils/platforms';
import { TestCase } from './utils/test-case';

// `noUncheckedIndexedAccess` types the level map's members as optional.
const WARN = pino.levels.values.warn!;

// Until @nestjs/platform-fastify@11.2.0, the adapter prepended the global prefix
// to every middleware path that did not already start with it, so a path
// excluded from the prefix could not be reached by middleware at all. The
// version is read off the file because v12's exports map does not expose
// `./package.json`.
const fastifyPlatform = JSON.parse(
  readFileSync('node_modules/@nestjs/platform-fastify/package.json', 'utf8'),
) as { version: string };

const fastifySupportsExcludedRoutes = atLeast(
  fastifyPlatform.version,
  [11, 2, 0],
);

function atLeast(version: string, min: [number, number, number]): boolean {
  const parts = version.split('.').map(Number);
  for (const [i, expected] of min.entries()) {
    if (parts[i] !== expected) return parts[i]! > expected;
  }
  return true;
}

// Regression test for #2213 / #2287.
//
// NestJS only warns about the legacy `*` wildcard when the path is *not* the
// bare "all" wildcard: `LegacyRouteConverter.tryConvert` skips the warning when
// the normalized route equals `/*/`. A global prefix turns our default route
// into `/v1/*`, which no longer hits that exemption. That is why this spec must
// set a global prefix — without one it stays green even on the broken default.
describe('global prefix', () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      let msg: string;
      let testCase: TestCase;

      beforeEach(() => {
        msg = Math.random().toString();

        @Controller('/')
        class TestController {
          private readonly logger = new Logger(TestController.name);

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
          controllers: [TestController],
        })
          .setGlobalPrefix('v1')
          .forRoot();
      });

      // The prefix root and a nested path fail independently: `/v1/{*splat}`
      // matches `/v1/deep` but not `/v1`, so both need asserting.
      for (const path of ['/v1', '/v1/deep']) {
        it(`keeps the request context on ${path}`, async () => {
          const logs = await testCase.run(path);
          expect(logs.some((v) => v.msg === msg && !!v.req)).toBeTruthy();
        });

        it(`still emits the automatic response log for ${path}`, async () => {
          const logs = await testCase.run(path);
          expect(logs.getResponseLog()).toBeTruthy();
        });
      }

      // Anchored on the level rather than on `context === 'LegacyRouteConverter'`
      // so that renaming that context upstream cannot turn the assertion vacuous.
      // Asserting an empty array instead of a boolean keeps the failure readable:
      // the diff prints the warning itself, which also tells an unrelated future
      // warning apart from this regression.
      it('starts up with no warnings at all', async () => {
        const logs = await testCase.run('/v1');
        const warnings = logs.filter((v) => (v.level as number) >= WARN);
        expect(warnings).toStrictEqual([]);
      });

      // Regression test for #2254.
      //
      // A path excluded from the global prefix is served outside it, while the
      // default route is prefixed like any other middleware route, so `/health`
      // is not covered by `/v1{/*splat}`. NestJS re-adds excluded paths on its
      // own, but only for routes its `RouteInfoPathExtractor.isAWildcard`
      // recognises, and `{/*splat}` is not one of them.
      describe('with a path excluded from the prefix', () => {
        beforeEach(() => {
          @Controller('/')
          class TestController {
            @Get()
            root() {
              return {};
            }
          }

          @Controller('health')
          class HealthController {
            @Get()
            health() {
              return {};
            }
          }

          testCase = new TestCase(new PlatformAdapter(), {
            controllers: [TestController, HealthController],
          })
            .setGlobalPrefix('v1', { exclude: ['health'] })
            .forRoot();
        });

        it.skipIf(
          PlatformAdapter.name === 'FastifyAdapter' &&
            !fastifySupportsExcludedRoutes,
        )('logs both the prefixed and the excluded path', async () => {
          const logs = await testCase.run('/v1', '/health');
          const completed = logs
            .filter((v) => v.msg === 'request completed')
            .map((v) => v.req?.url);
          expect(completed).toStrictEqual(['/v1', '/health']);
        });

        it('starts up with no warnings at all', async () => {
          const logs = await testCase.run('/health');
          const warnings = logs.filter((v) => (v.level as number) >= WARN);
          expect(warnings).toStrictEqual([]);
        });
      });
    });
  }
});
