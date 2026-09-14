import type { ExecutionContext } from '@nestjs/common';
import { EventPattern, MessagePattern, Transport } from '@nestjs/microservices';
import MemoryStream from 'memorystream';
import { defaultIfEmpty, firstValueFrom, of, throwError } from 'rxjs';

import { getRpcInfo, type MicroserviceParams, PinoLogger } from '../src';
import {
  getMicroserviceHook,
  registerMicroserviceHook,
} from '../src/microservice';
import { __resetOutOfContextForTests } from '../src/PinoLogger';
import type { Params } from '../src/params';

// The real decorators, so that the metadata keys this package reads
// reflectively are checked against the ones NestJS actually writes.
class UserController {
  @MessagePattern({ cmd: 'get_user' })
  getUser(_data?: unknown) {}

  @EventPattern('user.created')
  onCreated(_data?: unknown) {}

  @MessagePattern(['a', 'b'] as any)
  multi(_data?: unknown) {}

  plain() {}
}

class RmqContext {}

function contextFor(
  handler: (...args: any[]) => any,
  { data, rpcContext }: { data?: unknown; rpcContext?: unknown } = {},
): ExecutionContext {
  return {
    getType: () => 'rpc',
    getClass: () => UserController,
    getHandler: () => handler,
    switchToRpc: () => ({
      getData: () => data,
      getContext: () => rpcContext,
    }),
  } as unknown as ExecutionContext;
}

function build(
  microservice: MicroserviceParams<any> | boolean = true,
  extra: Partial<Params<any, any, any>> = {},
) {
  __resetOutOfContextForTests();
  const stream = new MemoryStream('', { readable: false });
  const params: Params<any, any, any> = {
    ...extra,
    microservice,
    pinoHttp: { ...(extra.pinoHttp as object), stream },
  };

  // Establishes the root logger the hook logs through.
  const logger = new PinoLogger(params);

  return {
    params,
    logger,
    hook: getMicroserviceHook(params),
    read: () =>
      (stream as { toString(): string })
        .toString()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, any>),
  };
}

const ok = () => of('result');
const fails = (error: Error) => () => throwError(() => error);

function run(
  hook: ReturnType<typeof getMicroserviceHook>,
  context: ExecutionContext,
  next: () => any = ok,
) {
  return firstValueFrom(hook(context, next).pipe(defaultIfEmpty(undefined)));
}

describe('getRpcInfo', () => {
  it('reads a message pattern', () => {
    const info = getRpcInfo(contextFor(UserController.prototype.getUser));

    expect(info).toMatchObject({
      type: 'message',
      pattern: { cmd: 'get_user' },
      controller: 'UserController',
      handler: 'getUser',
    });
  });

  it('reads an event pattern', () => {
    const info = getRpcInfo(contextFor(UserController.prototype.onCreated));

    expect(info).toMatchObject({ type: 'event', pattern: 'user.created' });
  });

  it('takes the transport from the per-message context class', () => {
    const info = getRpcInfo(
      contextFor(UserController.prototype.getUser, {
        rpcContext: new RmqContext(),
      }),
    );

    expect(info.transport).toBe('rmq');
  });

  it('keeps every pattern of a multi-pattern handler', () => {
    const info = getRpcInfo(contextFor(UserController.prototype.multi));

    expect(info.pattern).toEqual(['a', 'b']);
  });

  it('names every transport of the Transport enum', () => {
    // The lookup is positional, so a transport added to the middle of the enum
    // upstream would silently mislabel every log rather than fail. Driven by
    // the real decorator, so the metadata key is checked along with the names.
    for (const [name, value] of Object.entries(Transport)) {
      if (typeof value !== 'number') continue;

      class Holder {
        handle(_data?: unknown) {}
      }
      MessagePattern('pattern', value)(
        Holder.prototype,
        'handle',
        Object.getOwnPropertyDescriptor(Holder.prototype, 'handle')!,
      );

      // No per-message context, so the decorator metadata is the only source.
      expect(getRpcInfo(contextFor(Holder.prototype.handle)).transport).toBe(
        name.toLowerCase(),
      );
    }
  });

  it('falls back to a message for a handler with no metadata', () => {
    const info = getRpcInfo(contextFor(UserController.prototype.plain));

    expect(info).toMatchObject({
      type: 'message',
      pattern: undefined,
      transport: undefined,
      handler: 'plain',
    });
  });
});

describe('microservice hook', () => {
  it('logs a completed message with the rpc record', async () => {
    const { hook, read } = build();

    await run(hook, contextFor(UserController.prototype.getUser));

    const [log] = read();
    expect(log).toMatchObject({
      msg: 'message completed',
      reqId: 1,
      rpc: {
        type: 'message',
        pattern: { cmd: 'get_user' },
        controller: 'UserController',
        handler: 'getUser',
      },
    });
    expect(log!.responseTime).toBeTypeOf('number');
  });

  it('says event for an @EventPattern', async () => {
    const { hook, read } = build();

    await run(hook, contextFor(UserController.prototype.onCreated));

    expect(read()[0]).toMatchObject({
      msg: 'event completed',
      rpc: { type: 'event' },
    });
  });

  it('logs an error at error level and rethrows it', async () => {
    const { hook, read } = build();
    const error = new Error('boom');

    await expect(
      run(hook, contextFor(UserController.prototype.getUser), fails(error)),
    ).rejects.toBe(error);

    const [log] = read();
    expect(log).toMatchObject({ msg: 'message errored', level: 50 });
    expect(log!.err).toMatchObject({ message: 'boom' });
  });

  it('passes the handler result through untouched', async () => {
    const { hook } = build();

    await expect(
      run(hook, contextFor(UserController.prototype.getUser)),
    ).resolves.toBe('result');
  });

  it('keeps the context but drops the logs when autoLogging is false', async () => {
    const { hook, logger, read } = build({ autoLogging: false });

    await run(hook, contextFor(UserController.prototype.getUser), () => {
      logger.assign({ inside: true });
      logger.info('handler');
      return of('result');
    });

    expect(read()).toMatchObject([{ msg: 'handler', inside: true }]);
  });

  it('skips the logs of an ignored message but keeps the context', async () => {
    const { hook, logger, read } = build({
      autoLogging: { ignore: (ctx) => getRpcInfo(ctx).type === 'event' },
    });

    await run(hook, contextFor(UserController.prototype.onCreated), () => {
      logger.info('handler');
      return of('result');
    });

    expect(read().map((l) => l.msg)).toEqual(['handler']);
  });

  it('logs nothing on arrival unless asked to', async () => {
    const { hook, read } = build();
    await run(hook, contextFor(UserController.prototype.getUser));
    expect(read()).toHaveLength(1);

    const received = build({
      customReceivedMessage: () => 'incoming',
    });
    await run(received.hook, contextFor(UserController.prototype.getUser));
    expect(received.read().map((l) => l.msg)).toEqual([
      'incoming',
      'message completed',
    ]);
  });

  it('uses genReqId for the bound id', async () => {
    const { hook, read } = build({
      genReqId: (ctx) => `${getRpcInfo(ctx).handler}-1`,
    });

    await run(hook, contextFor(UserController.prototype.getUser));

    expect(read()[0]).toMatchObject({ reqId: 'getUser-1' });
  });

  it('honours customLogLevel, including silent', async () => {
    const { hook, read } = build({
      customLogLevel: (ctx, err) =>
        err ? 'silent' : getRpcInfo(ctx).type === 'event' ? 'debug' : 'warn',
    });

    await run(hook, contextFor(UserController.prototype.getUser));
    expect(read()[0]).toMatchObject({ level: 40 });

    await expect(
      run(
        hook,
        contextFor(UserController.prototype.getUser),
        fails(new Error('boom')),
      ),
    ).rejects.toBeDefined();
    expect(read()).toHaveLength(1);
  });

  it('refuses useLevel together with customLogLevel', () => {
    expect(() =>
      build({ useLevel: 'debug', customLogLevel: () => 'info' }),
    ).toThrow(/useLevel/);
  });

  it('applies useLevel to the completed log', async () => {
    const { hook, read } = build(
      { useLevel: 'debug' },
      { pinoHttp: { level: 'debug' } as any },
    );

    await run(hook, contextFor(UserController.prototype.getUser));

    expect(read()[0]).toMatchObject({ level: 20 });
  });

  it('honours the custom message and object builders', async () => {
    const { hook, read } = build({
      customSuccessMessage: (ctx, result, time) =>
        `${getRpcInfo(ctx).type} ${result} in ${typeof time}`,
      customSuccessObject: (_ctx, _result, value) => ({ ...value, extra: 1 }),
    });

    await run(hook, contextFor(UserController.prototype.getUser));

    expect(read()[0]).toMatchObject({
      msg: 'message result in number',
      extra: 1,
    });
  });

  it('honours the custom error message and object builders', async () => {
    const { hook, read } = build({
      customErrorMessage: (_ctx, err) => `failed: ${err.message}`,
      customErrorObject: (_ctx, _err, value) => ({ ...value, extra: 2 }),
    });

    await expect(
      run(
        hook,
        contextFor(UserController.prototype.getUser),
        fails(new Error('boom')),
      ),
    ).rejects.toBeDefined();

    expect(read()[0]).toMatchObject({ msg: 'failed: boom', extra: 2 });
  });

  it('binds customProps to the handler logs and the completed log', async () => {
    const { hook, logger, read } = build({
      customProps: (ctx) => ({ queue: getRpcInfo(ctx).handler }),
    });

    await run(hook, contextFor(UserController.prototype.getUser), () => {
      logger.info('handler');
      return of('result');
    });

    expect(read()).toMatchObject([
      { msg: 'handler', queue: 'getUser' },
      { msg: 'message completed', queue: 'getUser' },
    ]);
  });

  it('renames the keys it adds', async () => {
    const { hook, read } = build({
      customAttributeKeys: {
        rpc: 'call',
        reqId: 'correlationId',
        responseTime: 'took',
        err: 'error',
      },
    });

    await run(hook, contextFor(UserController.prototype.getUser));
    const [success] = read();
    expect(success).toHaveProperty('call');
    expect(success).toHaveProperty('correlationId');
    expect(success).toHaveProperty('took');

    const failing = build({
      customAttributeKeys: { err: 'error' },
    });
    await expect(
      run(
        failing.hook,
        contextFor(UserController.prototype.getUser),
        fails(new Error('boom')),
      ),
    ).rejects.toBeDefined();
    expect(failing.read()[0]).toHaveProperty('error');
  });

  it('drops the rpc record with quietRpcLogger and quietResLogger', async () => {
    const quietRpc = build({ quietRpcLogger: true });
    await run(
      quietRpc.hook,
      contextFor(UserController.prototype.getUser),
      () => {
        quietRpc.logger.info('handler');
        return of('result');
      },
    );
    const [handlerLog, completedLog] = quietRpc.read();
    expect(handlerLog).not.toHaveProperty('rpc');
    expect(handlerLog).toHaveProperty('reqId');
    // Only the logs made while handling are quieted, as in pino-http.
    expect(completedLog).toHaveProperty('rpc');

    const quietRes = build({ quietResLogger: true });
    await run(
      quietRes.hook,
      contextFor(UserController.prototype.getUser),
      () => {
        quietRes.logger.info('handler');
        return of('result');
      },
    );
    const [handler, completed] = quietRes.read();
    expect(handler).toHaveProperty('rpc');
    expect(completed).not.toHaveProperty('rpc');
  });

  it('leaves the payload out unless asked for it', async () => {
    const data = { password: 'secret' };

    const without = build();
    await run(
      without.hook,
      contextFor(UserController.prototype.getUser, { data }),
    );
    expect(without.read()[0]!.rpc).not.toHaveProperty('payload');

    const with_ = build({ includePayload: true });
    await run(
      with_.hook,
      contextFor(UserController.prototype.getUser, { data }),
    );
    expect(with_.read()[0]!.rpc.payload).toEqual(data);
  });

  it('lets redact reach the payload', async () => {
    const { hook, read } = build(
      { includePayload: true },
      { pinoHttp: { redact: ['rpc.payload.password'] } as any },
    );

    await run(
      hook,
      contextFor(UserController.prototype.getUser, {
        data: { password: 'secret' },
      }),
    );

    expect(read()[0]!.rpc.payload.password).toBe('[Redacted]');
  });

  it('keeps assign out of the completed log unless assignResponse is set', async () => {
    const plain = build(true);
    await run(plain.hook, contextFor(UserController.prototype.getUser), () => {
      plain.logger.assign({ assigned: true });
      return of('result');
    });
    expect(plain.read()[0]).not.toHaveProperty('assigned');

    const assigning = build(true, { assignResponse: true });
    await run(
      assigning.hook,
      contextFor(UserController.prototype.getUser),
      () => {
        assigning.logger.assign({ assigned: true });
        return of('result');
      },
    );
    expect(assigning.read()[0]).toMatchObject({ assigned: true });
  });

  it('numbers messages from one when no genReqId is given', async () => {
    const { hook, read } = build();

    await run(hook, contextFor(UserController.prototype.getUser));
    await run(hook, contextFor(UserController.prototype.getUser));

    expect(read().map((l) => l.reqId)).toEqual([1, 2]);
  });
});

describe('hook registration', () => {
  it('registers once, however many times it is asked', () => {
    const { params } = build();
    const registry = {
      hooks: [] as unknown[],
      registerPreRequestHook(...hooks: unknown[]) {
        this.hooks.push(...hooks);
      },
      getGlobalPreRequestHooks() {
        return this.hooks as any;
      },
    };

    expect(registerMicroserviceHook(registry, params)).toBe(true);
    expect(registerMicroserviceHook(registry, params)).toBe(true);

    expect(registry.hooks).toHaveLength(1);
  });

  it('degrades with a warning when the NestJS in use has no pre-request hooks', () => {
    const { params } = build();

    // What `ApplicationConfig` looks like on NestJS 11.
    expect(registerMicroserviceHook({}, params)).toBe(false);
  });
});
