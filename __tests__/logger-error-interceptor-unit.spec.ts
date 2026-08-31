import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, throwError } from 'rxjs';

import { LoggerErrorInterceptor } from '../src';

// Some execution contexts have no HTTP response to attach the error to — RPC
// and WebSocket contexts, and HTTP ones where the adapter has already torn the
// response down (see #1445). The interceptor must still rethrow rather than
// blow up on a missing response.
function contextReturning(response: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ExecutionContext;
}

function handlerThrowing(error: unknown): CallHandler {
  return { handle: () => throwError(() => error) };
}

describe('LoggerErrorInterceptor (unit)', () => {
  const interceptor = new LoggerErrorInterceptor();

  async function run(response: unknown, error: unknown) {
    return firstValueFrom(
      (await interceptor.intercept(
        contextReturning(response),
        handlerThrowing(error),
      )) as any,
    );
  }

  it('rethrows when there is no response to decorate', async () => {
    const error = new Error('boom');
    await expect(run(undefined, error)).rejects.toBe(error);
  });

  it('assigns the error on an express-like response', async () => {
    const error = new Error('boom');
    const response: Record<string, any> = {};

    await expect(run(response, error)).rejects.toBe(error);
    expect(response.err).toBe(error);
  });

  it('assigns the error on the raw object of a fastify-like response', async () => {
    const error = new Error('boom');
    const response: Record<string, any> = { raw: {} };

    await expect(run(response, error)).rejects.toBe(error);
    expect(response.raw.err).toBe(error);
    expect(response.err).toBeUndefined();
  });
});
