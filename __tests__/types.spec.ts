import { randomUUID } from 'node:crypto';

import type { Request, Response } from 'express';
import { stdTimeFunctions } from 'pino';
import type { Options } from 'pino-http';

import { getRpcInfo, LoggerModule, type Params, type RpcInfo } from '../src';

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

  it('accepts microservice parameters', () => {
    const params: Params = {
      microservice: {
        genReqId: (ctx) => getRpcInfo(ctx).handler,
        autoLogging: { ignore: (ctx) => getRpcInfo(ctx).type === 'event' },
        customLogLevel: (ctx, err) =>
          err ? 'error' : getRpcInfo(ctx).type === 'event' ? 'debug' : 'info',
        customSuccessMessage: (ctx, result, time) =>
          `${getRpcInfo(ctx).type} ${String(result)} ${time}`,
        customAttributeKeys: { rpc: 'call' },
        includePayload: true,
      },
    };
    expect(LoggerModule.forRoot(params).module).toBe(LoggerModule);

    // `true` is the shorthand for the defaults.
    expect(LoggerModule.forRoot({ microservice: true }).module).toBe(
      LoggerModule,
    );

    LoggerModule.forRoot({
      // @ts-expect-error `ignore` takes an ExecutionContext, not a request
      microservice: { autoLogging: { ignore: (req: Request) => !!req.url } },
    });
  });

  it('narrows the rpc type to its two literals', () => {
    const check = (info: RpcInfo) => {
      const type: 'message' | 'event' = info.type;
      // @ts-expect-error there is no third kind
      const wrong: 'message' = info.type;
      return [type, wrong];
    };
    expect(typeof check).toBe('function');
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

describe('dependencies the source must not take', () => {
  async function sources() {
    const { readdir, readFile } = await import('node:fs/promises');
    const files = await readdir('src');
    return Promise.all(
      files.map(async (file) => [file, await readFile(`src/${file}`, 'utf8')]),
    ) as Promise<Array<[string, string]>>;
  }

  it('never imports @nestjs/microservices', async () => {
    // The microservice support reads the metadata `@MessagePattern` and
    // `@EventPattern` write, by key, instead of importing anything: the package
    // does not export those keys anyway, and an application with no
    // microservices must not have to install it. Only a comment may mention it.
    for (const [file, source] of await sources()) {
      expect(
        source,
        `${file} must not import @nestjs/microservices`,
      ).not.toMatch(/(from|require\()\s*'@nestjs\/microservices/);
    }
  });

  it('never imports the v12-only PreRequestHook type', async () => {
    // `PreRequestHook` only exists in @nestjs/common v12, so importing it would
    // break `tsc` for everyone on v11. The hook type is declared structurally
    // in src/microservice.ts instead, and this keeps it that way.
    for (const [file, source] of await sources()) {
      const imports = source.match(/import[^;]*from '@nestjs\/common';/g) ?? [];
      for (const statement of imports) {
        expect(statement, `in ${file}`).not.toMatch(/\bPreRequestHook\b/);
      }
    }
  });
});
