import { Controller, Get } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import MemoryStream from 'memorystream';

import { PinoLogger } from '../src';
import { __resetOutOfContextForTests } from '../src/PinoLogger';
import type { Params } from '../src/params';

import type { Adapter } from './utils/platforms';
import { TestCase } from './utils/test-case';

// Both cases below are platform independent, so one adapter is enough. It goes
// through `Adapter` because `TestCase` takes the loosely instantiated shape.
const PlatformAdapter: Adapter = ExpressAdapter;

function build(params: Omit<Params, 'pinoHttp'> & { pinoHttp?: any } = {}) {
  __resetOutOfContextForTests();
  const stream = new MemoryStream('', { readable: false });
  const logger = new PinoLogger({
    ...params,
    pinoHttp: { ...params.pinoHttp, stream },
  });
  return {
    logger,
    read: () =>
      (stream as { toString(): string })
        .toString()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, any>),
  };
}

describe('root logger', () => {
  it('is exposed without any HTTP middleware', () => {
    // `configure` is only ever called for an HTTP application, so before the
    // root logger was shared there was nothing to expose in a microservice or
    // a standalone script.
    const { logger } = build();

    expect(PinoLogger.root).toBeDefined();
    expect(logger.logger).toBe(PinoLogger.root);
  });

  it('governs logs made outside of a request', () => {
    // The out-of-request logger used to be a second, unrelated instance, so
    // changing the root at runtime only ever affected request logs.
    const { logger, read } = build({ pinoHttp: { level: 'silent' } });

    logger.info('before');
    PinoLogger.root.level = 'info';
    logger.info('after');

    const logs = read();
    expect(logs.map((l) => l.msg)).toEqual(['after']);
  });

  it('is built once and reused by every logger', () => {
    __resetOutOfContextForTests();
    const stream = new MemoryStream('', { readable: false });
    const params: Params = { pinoHttp: { stream } };

    const first = new PinoLogger(params);
    const second = new PinoLogger(params);

    expect(first.logger).toBe(second.logger);
  });

  // The root logger must be the one `pino-http` builds from the parameters, not
  // one derived from it with `pino.child(bindings, options)`, which re-applies
  // part of the options. Custom levels are the loudest thing that breaks under
  // that — applying them twice goes through `assertNoLevelCollisions`, which
  // throws — and they had no runtime coverage of their own.
  describe('options that cannot be applied twice', () => {
    it('keeps custom levels working', async () => {
      @Controller('/')
      class TestController {
        constructor(private readonly logger: PinoLogger<'audit'>) {}

        @Get()
        get() {
          this.logger.logger.audit('audited');
          return {};
        }
      }

      const logs = await new TestCase(new PlatformAdapter(), {
        controllers: [TestController],
      })
        .forRoot({ pinoHttp: { customLevels: { audit: 35 } } })
        .run();

      expect(logs.find((l) => l.msg === 'audited')).toMatchObject({
        level: 35,
      });
    });
  });
});
