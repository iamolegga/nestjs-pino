import MemoryStream from 'memorystream';

import { Logger, NativeLogger, nativeLoggerOptions, PinoLogger } from '../src';
import { __resetOutOfContextForTests } from '../src/PinoLogger';
import { Params } from '../src/params';

const STACK = 'Error: boom\n    at Object.<anonymous> (/test.js:1:1)';

// These specs call the loggers directly instead of going through NestJS's
// built-in `Logger`. That is not an artificial shortcut: `Logger` always
// appends its context as a third argument, so `error(msg, stack)` never reaches
// the classes as a two-argument call, and those branches are unreachable from
// an application-level test.
function build(nativeLogger?: Params['nativeLogger']) {
  __resetOutOfContextForTests();
  const stream = new MemoryStream('', { readable: false });
  const params: Params = {
    pinoHttp: { ...nativeLoggerOptions, stream },
    nativeLogger,
  };
  const pinoLogger = new PinoLogger(params);
  return {
    native: new NativeLogger(pinoLogger, params),
    nest: new Logger(pinoLogger, params),
    read: () =>
      // MemoryStream's `toString` is not in its type definitions.
      (stream as { toString(): string })
        .toString()
        .split('\n')
        .filter(Boolean)
        .map((l: string) => JSON.parse(l) as Record<string, any>),
  };
}

describe('direct logger calls', () => {
  describe('NativeLogger', () => {
    it('logs a lone message with no context', () => {
      const { native, read } = build();
      native.log('solo');

      const logs = read();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.message).toBe('solo');
      expect(logs[0]!.context).toBeUndefined();
    });

    it('treats a trailing string as the context', () => {
      const { native, read } = build();
      native.error('boom', 'Ctx');

      const logs = read();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.message).toBe('boom');
      expect(logs[0]!.context).toBe('Ctx');
      expect(logs[0]!.stack).toBeUndefined();
    });

    it('treats a trailing stack as the stack, not the context', () => {
      const { native, read } = build();
      native.error('boom', STACK);

      const logs = read();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.message).toBe('boom');
      expect(logs[0]!.stack).toBe(STACK);
      expect(logs[0]!.context).toBeUndefined();
    });

    it('keeps the stack when more arguments precede it', () => {
      const { native, read } = build({ structuredParams: true });
      native.error('boom', { a: 1 }, STACK);

      const logs = read();
      expect(logs.every((l) => l.stack === STACK)).toBe(true);
      expect(logs.every((l) => l.context === undefined)).toBe(true);
      expect(logs.some((l) => l.message === 'boom')).toBe(true);
      expect(logs).toHaveLength(1);
      expect(logs[0]!.params).toEqual({ a: 1 });
    });

    it('extracts the context when the trailing argument is not a stack', () => {
      const { native, read } = build({ structuredParams: true });
      native.error('boom', { a: 1 }, 'Ctx');

      const logs = read();
      expect(logs.every((l) => l.context === 'Ctx')).toBe(true);
      expect(logs.every((l) => l.stack === undefined)).toBe(true);
      expect(logs).toHaveLength(1);
      expect(logs[0]!.params).toEqual({ a: 1 });
    });

    it('does not mistake a trailing object for a stack or a context', () => {
      const { native, read } = build({ structuredParams: true });
      native.error('boom', 123, { a: 1 });

      const logs = read();
      expect(logs.every((l) => l.stack === undefined)).toBe(true);
      expect(logs.every((l) => l.context === undefined)).toBe(true);
      expect(logs.some((l) => l.message === '123')).toBe(true);
    });

    it('falls back to the message of an Error that carries no stack', () => {
      const { native, read } = build();
      const error = new Error('stackless');
      delete (error as { stack?: string }).stack;
      native.log(error);

      const logs = read();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.message).toBe('stackless');
    });

    it('handles a lone trailing object that is neither stack nor context', () => {
      const { native, read } = build({ structuredParams: true });
      native.error('boom', { a: 1 });

      const logs = read();
      expect(logs.every((l) => l.context === undefined)).toBe(true);
      expect(logs.every((l) => l.stack === undefined)).toBe(true);
      expect(logs.some((l) => l.message === 'boom')).toBe(true);
      expect(logs).toHaveLength(1);
      expect(logs[0]!.params).toEqual({ a: 1 });
    });

    it('treats a null-prototype object as a plain object', () => {
      const { native, read } = build({ structuredParams: true });
      const bag = Object.create(null) as Record<string, unknown>;
      bag.a = 1;
      native.log('msg', bag, 'Ctx');

      const logs = read();
      expect(logs.every((l) => l.context === 'Ctx')).toBe(true);
      expect(logs).toHaveLength(1);
      expect(logs[0]!.params).toEqual({ a: 1 });
    });
  });

  // These mirror `ConsoleLoggerOptions` of the same name so an application can
  // move from ConsoleLogger keeping its configuration. Unlike NestJS they are
  // honoured on every supported major, because the collecting is implemented
  // here rather than delegated.
  describe('nativeLogger options', () => {
    it('nests params by default when structuredParams is on', () => {
      const { native, read } = build({ structuredParams: true });
      native.log('msg', { a: 1 }, 'Ctx');

      const logs = read();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.params).toEqual({ a: 1 });
      expect(logs[0]!.a).toBeUndefined();
    });

    it('omits the params field when there is nothing to collect', () => {
      const { native, read } = build({ structuredParams: true });
      native.log('msg', 'Ctx');

      const logs = read();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.message).toBe('msg');
      expect(logs[0]!.context).toBe('Ctx');
      expect(logs[0]!.params).toBeUndefined();
    });

    it('spreads params into the root when flattenParams is on', () => {
      const { native, read } = build({
        structuredParams: true,
        flattenParams: true,
      });
      native.log('msg', { a: 1 }, 'Ctx');

      const logs = read();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.a).toBe(1);
      expect(logs[0]!.params).toBeUndefined();
      expect(logs[0]!.message).toBe('msg');
      expect(logs[0]!.context).toBe('Ctx');
    });

    it('logs every argument separately when structuredParams is off', () => {
      const { native, read } = build({ structuredParams: false });
      native.log('msg', { a: 1 }, 'Ctx');

      const logs = read();
      expect(logs).toHaveLength(2);
      expect(logs.every((l) => l.params === undefined)).toBe(true);
      expect(logs.some((l) => l.message === 'msg')).toBe(true);
      expect(logs.some((l) => l.message?.a === 1)).toBe(true);
    });

    it('prefers an explicit context over a flattened param of the same name', () => {
      const { native, read } = build({
        structuredParams: true,
        flattenParams: true,
      });
      native.log('msg', { context: 'HACK', a: 1 }, 'Ctx');

      const logs = read();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.context).toBe('Ctx');
      expect(logs[0]!.a).toBe(1);
    });

    it('uses a flattened context param when the call sets no context', () => {
      const { native, read } = build({
        structuredParams: true,
        flattenParams: true,
      });
      native.log('msg', { context: 'FromParam' });

      const logs = read();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.context).toBe('FromParam');
    });

    it('respects renameContext when a param uses the renamed key', () => {
      __resetOutOfContextForTests();
      const stream = new MemoryStream('', { readable: false });
      const params: Params = {
        pinoHttp: { ...nativeLoggerOptions, stream },
        renameContext: 'scope',
        nativeLogger: { structuredParams: true, flattenParams: true },
      };
      const native = new NativeLogger(new PinoLogger(params), params);
      native.log('msg', { scope: 'HACK', a: 1 }, 'Ctx');

      const logs = (stream as { toString(): string })
        .toString()
        .split('\n')
        .filter(Boolean)
        .map((l: string) => JSON.parse(l) as Record<string, any>);

      expect(logs[0]!.scope).toBe('Ctx');
      expect(logs[0]!.a).toBe(1);
    });
  });

  describe('Logger', () => {
    // `Logger` takes the *last* argument as the context, so this is the shape
    // `someLogger.error(msg, stack)` arrives in once NestJS's built-in `Logger`
    // has appended its context. It must produce a real `err` rather than
    // interpolating the stack into the message.
    it('turns a message plus a stack into an `err` object', () => {
      const { nest, read } = build();
      nest.error('boom', STACK, 'Ctx');

      const logs = read();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.err).toMatchObject({ message: 'boom', stack: STACK });
    });

    it('keeps a non-stack string as a plain argument', () => {
      const { nest, read } = build();
      nest.error('boom', 'not a stack', 'Ctx');

      const logs = read();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.err).toBeUndefined();
    });
  });
});
