import {
  type CanActivate,
  Catch,
  Controller,
  Injectable,
  type RpcExceptionFilter,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  EventPattern,
  MessagePattern,
  Payload,
  RpcException,
} from '@nestjs/microservices';
import { firstValueFrom, of } from 'rxjs';

import { getRpcInfo, PinoLogger } from '../src';
import { hasPreRequestHooks } from './utils/has-pre-request-hooks';
import { MicroserviceTestCase } from './utils/microservice-test-case';

@Injectable()
class TestService {
  constructor(private readonly logger: PinoLogger) {}

  work() {
    this.logger.info('from the service');
  }
}

@Injectable()
class LoggingGuard implements CanActivate {
  constructor(private readonly logger: PinoLogger) {}

  canActivate() {
    this.logger.info('from the guard');
    return true;
  }
}

@Catch(RpcException)
class HandleEverything implements RpcExceptionFilter {
  catch() {
    return of({ handledByFilter: true });
  }
}

@Controller()
class TestController {
  constructor(
    private readonly logger: PinoLogger,
    private readonly service: TestService,
  ) {}

  @MessagePattern({ cmd: 'greet' })
  @UseGuards(LoggingGuard)
  greet(@Payload() data: { name: string }) {
    this.logger.assign({ user: data.name });
    this.logger.info('handling');
    this.service.work();
    return `hello ${data.name}`;
  }

  @EventPattern('user.created')
  created(@Payload() _data: unknown) {
    this.logger.info('event handled');
  }

  /** Logs without `assign`, so it works with or without a logging context. */
  @MessagePattern({ cmd: 'plain' })
  plain() {
    this.logger.info('plain handled');
    return 'plain reply';
  }

  @MessagePattern({ cmd: 'fail' })
  fail(@Payload() _data: unknown) {
    throw new Error('boom');
  }

  /** Throws on purpose, and a filter turns it into an ordinary reply. */
  @MessagePattern({ cmd: 'business' })
  @UseFilters(HandleEverything)
  business(@Payload() _data: unknown) {
    throw new RpcException('nope');
  }

  @MessagePattern({ cmd: 'slow' })
  async slow(@Payload() data: { id: number; delay: number }) {
    this.logger.assign({ id: data.id });
    await new Promise((resolve) => setTimeout(resolve, data.delay));
    this.logger.info('slow done');
    return data.id;
  }

  @MessagePattern({ cmd: 'root' })
  root(@Payload() _data: unknown) {
    return PinoLogger.root !== undefined;
  }
}

function testCase() {
  return new MicroserviceTestCase({
    controllers: [TestController],
    providers: [TestService, LoggingGuard],
  });
}

// Pre-request hooks arrived in NestJS 12; on the v11 leg of the CI matrix
// there is nothing to hook into. This is the very check the module makes at
// runtime before registering.
describe.skipIf(!hasPreRequestHooks())('microservice', () => {
  it('logs a completed message and replies untouched', async () => {
    let reply: unknown;

    const logs = await testCase()
      .forRoot({ microservice: true })
      .run(async (client) => {
        reply = await firstValueFrom(
          client.send({ cmd: 'greet' }, { name: 'ann' }),
        );
      });

    expect(reply).toBe('hello ann');

    const completed = logs.find((l) => l.msg === 'message completed');
    expect(completed).toMatchObject({
      rpc: {
        type: 'message',
        pattern: { cmd: 'greet' },
        transport: 'tcp',
        controller: 'TestController',
        handler: 'greet',
      },
    });
    expect(completed!.responseTime).toBeTypeOf('number');
  });

  it('gives every log made while handling the message its context', async () => {
    const logs = await testCase()
      .forRoot({ microservice: true })
      .run((client) =>
        firstValueFrom(client.send({ cmd: 'greet' }, { name: 'ann' })),
      );

    const handling = logs.find((l) => l.msg === 'handling');
    const service = logs.find((l) => l.msg === 'from the service');

    for (const log of [handling, service]) {
      expect(log).toMatchObject({ user: 'ann', rpc: { handler: 'greet' } });
      expect(log!.reqId).toBeDefined();
    }
  });

  it('runs before the guards, so their logs have the context too', async () => {
    // This is what a pre-request hook buys over an interceptor, which would
    // only start after the guards had already run.
    const logs = await testCase()
      .forRoot({ microservice: true })
      .run((client) =>
        firstValueFrom(client.send({ cmd: 'greet' }, { name: 'ann' })),
      );

    const guard = logs.find((l) => l.msg === 'from the guard');
    expect(guard).toMatchObject({ rpc: { handler: 'greet' } });
    expect(guard!.reqId).toBeDefined();
    // The guard runs before the handler assigned anything.
    expect(guard).not.toHaveProperty('user');
  });

  it('logs an event as an event', async () => {
    const logs = await testCase()
      .forRoot({ microservice: true })
      .run(async (client) => {
        client.emit('user.created', { id: 1 });
      });

    expect(logs.find((l) => l.msg === 'event completed')).toMatchObject({
      rpc: { type: 'event', pattern: 'user.created', handler: 'created' },
    });
    expect(logs.find((l) => l.msg === 'event handled')).toBeDefined();
  });

  it('logs a failed message and still rejects the caller', async () => {
    let rejected = false;

    const logs = await testCase()
      .forRoot({ microservice: true })
      .run(async (client) => {
        await firstValueFrom(client.send({ cmd: 'fail' }, {})).catch(() => {
          rejected = true;
        });
      });

    expect(rejected).toBe(true);

    const errored = logs.find((l) => l.msg === 'message errored');
    expect(errored).toMatchObject({ level: 50, rpc: { handler: 'fail' } });
    expect(errored!.err).toMatchObject({ message: 'boom' });
  });

  it('logs an error the application handles itself', async () => {
    // The hook runs inside `RpcProxy`, whose `catchError` applies the exception
    // filters, so it sees the error first — a deliberate `RpcException` that a
    // filter turns into an ordinary reply included.
    let reply: unknown;

    const logs = await testCase()
      .forRoot({ microservice: true })
      .run(async (client) => {
        reply = await firstValueFrom(client.send({ cmd: 'business' }, {}));
      });

    expect(reply).toEqual({ handledByFilter: true });

    const errored = logs.find((l) => l.msg === 'message errored');
    expect(errored).toMatchObject({ level: 50, rpc: { handler: 'business' } });
  });

  it('keeps concurrent messages apart', async () => {
    const logs = await testCase()
      .forRoot({ microservice: true })
      .run(async (client) => {
        await Promise.all([
          firstValueFrom(client.send({ cmd: 'slow' }, { id: 1, delay: 60 })),
          firstValueFrom(client.send({ cmd: 'slow' }, { id: 2, delay: 20 })),
          firstValueFrom(client.send({ cmd: 'slow' }, { id: 3, delay: 40 })),
        ]);
      });

    const done = logs.filter((l) => l.msg === 'slow done');
    expect(done).toHaveLength(3);

    // Each message kept its own `assign`, and its own reqId.
    const pairs = done.map((l) => `${l.reqId}:${l.id}`);
    expect(new Set(pairs).size).toBe(3);
    expect(done.map((l) => l.id).sort()).toEqual([1, 2, 3]);
  });

  it('exposes the root logger in a microservice application', async () => {
    let hasRoot: unknown;

    await testCase()
      .forRoot({ microservice: true })
      .run(async (client) => {
        hasRoot = await firstValueFrom(client.send({ cmd: 'root' }, {}));
      });

    expect(hasRoot).toBe(true);
  });

  it('honours the parameters end to end', async () => {
    const logs = await testCase()
      .forRoot({
        microservice: {
          genReqId: () => 'fixed-id',
          customSuccessMessage: (ctx) => `${getRpcInfo(ctx).handler} ok`,
          customProps: () => ({ service: 'users' }),
          includePayload: true,
        },
      })
      .run((client) =>
        firstValueFrom(client.send({ cmd: 'greet' }, { name: 'ann' })),
      );

    const completed = logs.find((l) => l.msg === 'greet ok');
    expect(completed).toMatchObject({
      reqId: 'fixed-id',
      service: 'users',
      rpc: { payload: { name: 'ann' } },
    });
  });

  it('does nothing at all when microservice is not configured', async () => {
    const logs = await testCase()
      .forRoot({})
      .run((client) => firstValueFrom(client.send({ cmd: 'plain' }, {})));

    expect(logs.some((l) => l.msg === 'message completed')).toBe(false);

    // The handler still runs and still logs — just without a context, which is
    // also why `assign` would still throw there.
    const handled = logs.find((l) => l.msg === 'plain handled');
    expect(handled).toBeDefined();
    expect(handled).not.toHaveProperty('rpc');
  });

  it('can be registered by hand', async () => {
    const logs = await testCase()
      .forRoot({})
      .run(
        (client) =>
          firstValueFrom(client.send({ cmd: 'greet' }, { name: 'ann' })),
        { manualHook: true },
      );

    expect(logs.find((l) => l.msg === 'message completed')).toMatchObject({
      rpc: { handler: 'greet' },
    });
  });

  describe('hybrid application', () => {
    it('works when connected with inheritAppConfig', async () => {
      const logs = await testCase()
        .forRoot({ microservice: true })
        .runHybrid((client) =>
          firstValueFrom(client.send({ cmd: 'greet' }, { name: 'ann' })),
        );

      expect(logs.find((l) => l.msg === 'message completed')).toMatchObject({
        rpc: { handler: 'greet' },
      });
      expect(logs.find((l) => l.msg === 'handling')).toMatchObject({
        user: 'ann',
      });
    });

    it('degrades without inheritAppConfig instead of breaking', async () => {
      // NestJS builds such a microservice its own `ApplicationConfig`, which
      // dependency injection cannot reach, so the hook never arrives.
      let reply: unknown;

      const logs = await testCase()
        .forRoot({ microservice: true })
        .runHybrid(
          async (client) => {
            reply = await firstValueFrom(client.send({ cmd: 'plain' }, {}));
          },
          { inheritAppConfig: false },
        );

      expect(reply).toBe('plain reply');
      expect(logs.some((l) => l.msg === 'message completed')).toBe(false);
      expect(logs.find((l) => l.msg === 'plain handled')).toBeDefined();
    });
  });
});
