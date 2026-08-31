import { randomUUID } from 'node:crypto';

import type { Request, Response } from 'express';
import { stdTimeFunctions } from 'pino';
import type { Options } from 'pino-http';

import { LoggerModule, type Params } from '../src';

// Compile-time coverage. `npm run lint` runs `tsc --noemit` over this file, so
// a regression in the generic signatures fails the build rather than a test.
describe('types', () => {
  it('accepts express Request/Response in pinoHttp options (#2075)', () => {
    const pinoHttp: Options<Request, Response> = {
      genReqId: (req) => req.headers['x-correlation-id'] ?? randomUUID(),
      timestamp: stdTimeFunctions.isoTime,
      serializers: { req: (req: Request) => ({ id: req.id }) },
      customReceivedObject: (req: Request) => ({
        url: req.url,
        method: req.method,
        query: req.query,
      }),
    };

    const params: Params<Request, Response> = { pinoHttp };
    expect(LoggerModule.forRoot(params).module).toBe(LoggerModule);

    // Proves the type parameters are load-bearing: without them `Params`
    // defaults to IncomingMessage/ServerResponse and this assignment is exactly
    // the error reported in #2075. If the generics regressed, `ts-expect-error`
    // would itself become an unused-directive error.
    // @ts-expect-error express Request is not an IncomingMessage
    const wrong: Params = { pinoHttp };
    expect(wrong).toBeTruthy();
  });

  it('accepts custom levels (#1863)', () => {
    type CustomLevels = 'audit';

    const params: Params<Request, Response, CustomLevels> = {
      pinoHttp: {
        customLevels: { audit: 35 },
        useLevel: 'audit',
        customLogLevel: () => 'audit',
      },
    };

    expect(LoggerModule.forRoot(params).module).toBe(LoggerModule);
  });

  it('still accepts unparameterised Params', () => {
    const params: Params = { pinoHttp: { level: 'info' } };
    expect(LoggerModule.forRoot(params).module).toBe(LoggerModule);
    expect(LoggerModule.forRoot().module).toBe(LoggerModule);
  });

  it('type-checks the inject array of forRootAsync', () => {
    class Config {}

    // Valid tokens: classes, strings, symbols, optional-dependency objects.
    const ok = LoggerModule.forRootAsync({
      inject: [Config, 'STRING_TOKEN', { token: Config, optional: true }],
      useFactory: (): Params => ({ pinoHttp: { level: 'info' } }),
    });
    expect(ok.module).toBe(LoggerModule);

    LoggerModule.forRootAsync({
      // Used to be `any[]`, so garbage like this went through unnoticed.
      // @ts-expect-error 123 is not an injection token
      inject: [123],
      useFactory: (): Params => ({}),
    });
  });

  it('exposes custom levels on PinoLogger#logger', () => {
    type CustomLevels = 'audit';
    const check = (logger: import('../src').PinoLogger<CustomLevels>) => {
      // Reachable through `.logger`; see the PinoLogger doc comment for why the
      // level is not synthesised onto the class itself.
      const fn: (msg: string) => void = logger.logger.audit;
      return fn;
    };
    expect(typeof check).toBe('function');
  });
});
