import { Controller, Get, Injectable } from '@nestjs/common';
import MemoryStream from 'memorystream';

import { PinoLogger } from '../src';
import { __resetOutOfContextForTests } from '../src/PinoLogger';
import type { Params } from '../src/params';

import { platforms } from './utils/platforms';
import { TestCase } from './utils/test-case';

function build() {
  __resetOutOfContextForTests();
  const stream = new MemoryStream('', { readable: false });
  const params: Params = { pinoHttp: { stream } };
  return {
    logger: new PinoLogger(params),
    read: () =>
      (stream as { toString(): string })
        .toString()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, any>),
  };
}

describe('runInContext', () => {
  it('makes assign work outside of a request', () => {
    const { logger, read } = build();

    expect(() => logger.assign({ foo: 'bar' })).toThrow();

    logger.runInContext(() => {
      logger.assign({ foo: 'bar' });
      logger.info('inside');
    });

    expect(read()).toMatchObject([{ msg: 'inside', foo: 'bar' }]);
  });

  it('binds the given fields to every log inside', () => {
    const { logger, read } = build();

    logger.runInContext(
      () => {
        logger.info('one');
        logger.info('two');
      },
      { bindings: { jobId: 7 } },
    );

    expect(read()).toMatchObject([
      { msg: 'one', jobId: 7 },
      { msg: 'two', jobId: 7 },
    ]);
  });

  it('closes the context afterwards, on return and on throw', () => {
    const { logger } = build();

    expect(logger.runInContext(() => 42)).toBe(42);
    expect(() => logger.assign({ a: 1 })).toThrow();

    expect(() =>
      logger.runInContext(() => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(() => logger.assign({ a: 1 })).toThrow();
  });

  it('survives awaits', async () => {
    const { logger, read } = build();

    await logger.runInContext(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      logger.assign({ step: 'after await' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      logger.info('done');
    });

    expect(read()).toMatchObject([{ msg: 'done', step: 'after await' }]);
  });

  it('keeps concurrent contexts apart', async () => {
    const { logger, read } = build();

    const run = (id: number, delay: number) =>
      logger.runInContext(
        async () => {
          logger.assign({ assigned: id });
          await new Promise((resolve) => setTimeout(resolve, delay));
          logger.info('done');
        },
        { bindings: { bound: id } },
      );

    await Promise.all([run(1, 30), run(2, 10), run(3, 20)]);

    const logs = read();
    expect(logs).toHaveLength(3);
    for (const log of logs) {
      expect(log.bound).toBe(log.assigned);
    }
    expect(logs.map((l) => l.bound).sort()).toEqual([1, 2, 3]);
  });

  it('nests without disturbing the surrounding context', () => {
    const { logger, read } = build();

    logger.runInContext(
      () => {
        logger.runInContext(
          () => {
            logger.info('inner');
          },
          { bindings: { inner: true } },
        );
        logger.info('outer');
      },
      { bindings: { outer: true } },
    );

    const [inner, outer] = read();
    expect(inner).toMatchObject({ msg: 'inner', inner: true });
    expect(inner).not.toHaveProperty('outer');
    expect(outer).toMatchObject({ msg: 'outer', outer: true });
    expect(outer).not.toHaveProperty('inner');
  });

  it('falls back to the root when asked to inherit with no context', () => {
    const { logger, read } = build();

    expect(() =>
      logger.runInContext(
        () => {
          logger.info('orphan');
        },
        { inherit: true },
      ),
    ).not.toThrow();

    expect(read()).toMatchObject([{ msg: 'orphan' }]);
  });

  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      it('inherits the request fields without leaking assign back into it', async () => {
        @Injectable()
        class TestService {
          constructor(private readonly logger: PinoLogger) {}

          detached() {
            return this.logger.runInContext(
              () => {
                this.logger.assign({ detached: true });
                this.logger.info('inside');
              },
              { inherit: true },
            );
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
            this.logger.assign({ request: true });
            this.service.detached();
            this.logger.info('outside');
            return {};
          }
        }

        const logs = await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
          providers: [TestService],
        })
          .forRoot({
            pinoHttp: { customSuccessMessage: () => 'success' },
            assignResponse: true,
          })
          .run();

        const inside = logs.find((l) => l.msg === 'inside');
        // Inherited: the fields the request had when the nested context opened.
        expect(inside).toMatchObject({ request: true, detached: true });
        expect(inside!.req).toBeDefined();

        // The request itself is untouched by what the nested context assigned.
        const outside = logs.find((l) => l.msg === 'outside');
        expect(outside).toMatchObject({ request: true });
        expect(outside).not.toHaveProperty('detached');

        const response = logs.find((l) => l.msg === 'success');
        expect(response).toMatchObject({ request: true });
        expect(response).not.toHaveProperty('detached');
      });
    });
  }
});
