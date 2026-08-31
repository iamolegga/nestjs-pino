import {
  ConsoleLogger,
  type ConsoleLoggerOptions,
  Controller,
  Get,
  Logger,
} from '@nestjs/common';

import { NativeLogger, nativeLoggerOptions } from '../src';

import { platforms } from './utils/platforms';
import { TestCase } from './utils/test-case';

// Same capability probe NativeLogger uses, see src/NativeLogger.ts.
const hasStructuredParams = 'stringifyParams' in ConsoleLogger.prototype;

// Helper to capture ConsoleLogger JSON output by intercepting stdout/stderr
function captureConsoleLoggerOutput(
  fn: (logger: ConsoleLogger) => void,
  // Typed loosely on purpose: `flattenParams` only exists in the NestJS 12
  // typings, so a literal would not compile on the v11 leg of the matrix.
  options: Record<string, unknown> = {},
): Record<string, any>[] {
  const captured: string[] = [];

  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = (chunk: string) => {
    if (typeof chunk === 'string' && chunk.startsWith('{')) {
      captured.push(chunk.trim());
    }
    return true;
  };

  process.stderr.write = (chunk: string) => {
    if (typeof chunk === 'string' && chunk.startsWith('{')) {
      captured.push(chunk.trim());
    }
    return true;
  };

  try {
    const logger = new ConsoleLogger('TestController', {
      json: true,
      ...options,
    } as ConsoleLoggerOptions);
    fn(logger);
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }

  return captured.map((line) => JSON.parse(line));
}

describe('NativeLogger vs ConsoleLogger comparison', () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      it('single string message produces matching fields', async () => {
        const msg = Math.random().toString();

        // Capture ConsoleLogger output
        const consoleLogs = captureConsoleLoggerOutput((logger) => {
          logger.log(msg);
        });

        // Capture NativeLogger output
        @Controller('/')
        class TestController {
          private readonly logger = new Logger(TestController.name);
          @Get()
          get() {
            this.logger.log(msg);
            return {};
          }
        }

        const pinoLogs = await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
        })
          .useLoggerClass(NativeLogger)
          .forRoot({ pinoHttp: nativeLoggerOptions })
          .run();

        const consoleLog = consoleLogs[0]!;
        const pinoLog = pinoLogs.find((v) => v.message === msg)!;

        // Same number of app-level log entries
        expect(consoleLogs).toHaveLength(1);
        expect(pinoLog).toBeTruthy();

        // Same fields present
        expect(consoleLog.message).toBe(msg);
        expect(pinoLog.message).toBe(msg);

        expect(consoleLog.context).toBe('TestController');
        expect(pinoLog.context).toBe('TestController');

        expect(consoleLog.level).toBe('log');
        expect(pinoLog.level).toBe('log');

        expect(typeof consoleLog.pid).toBe('number');
        expect(typeof pinoLog.pid).toBe('number');

        expect(typeof consoleLog.timestamp).toBe('number');
        expect(typeof pinoLog.timestamp).toBe('number');
      });

      it('multiple messages are each logged separately', async () => {
        const msg1 = Math.random().toString();
        const msg2 = Math.random().toString();

        const consoleLogs = captureConsoleLoggerOutput((logger) => {
          logger.log(msg1, msg2, 'TestController');
        });

        @Controller('/')
        class TestController {
          private readonly logger = new Logger(TestController.name);
          @Get()
          get() {
            // NestJS Logger forwards: log(msg1, msg2, 'TestController')
            this.logger.log(msg1, msg2);
            return {};
          }
        }

        const pinoLogs = await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
        })
          .useLoggerClass(NativeLogger)
          .forRoot({ pinoHttp: nativeLoggerOptions })
          .run();

        // ConsoleLogger logs each message separately
        expect(consoleLogs).toHaveLength(2);
        expect(consoleLogs[0]!.message).toBe(msg1);
        expect(consoleLogs[1]!.message).toBe(msg2);

        // NativeLogger also logs each message separately
        const pinoLog1 = pinoLogs.find((v) => v.message === msg1);
        const pinoLog2 = pinoLogs.find((v) => v.message === msg2);
        expect(pinoLog1).toBeTruthy();
        expect(pinoLog2).toBeTruthy();

        // Both have same context
        expect(consoleLogs[0]!.context).toBe('TestController');
        expect(consoleLogs[1]!.context).toBe('TestController');
        expect(pinoLog1!.context).toBe('TestController');
        expect(pinoLog2!.context).toBe('TestController');
      });

      it('error with stack trace has same fields', async () => {
        const msg = Math.random().toString();
        const stack = `Error: ${msg}\n    at Object.<anonymous> (/test.js:1:1)`;

        const consoleLogs = captureConsoleLoggerOutput((logger) => {
          logger.error(msg, stack, 'TestController');
        });

        @Controller('/')
        class TestController {
          private readonly logger = new Logger(TestController.name);
          @Get()
          get() {
            this.logger.error(msg, stack);
            return {};
          }
        }

        const pinoLogs = await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
        })
          .useLoggerClass(NativeLogger)
          .forRoot({ pinoHttp: nativeLoggerOptions })
          .run();

        const consoleLog = consoleLogs[0]!;
        const pinoLog = pinoLogs.find((v) => v.message === msg)!;

        expect(consoleLogs).toHaveLength(1);
        expect(pinoLog).toBeTruthy();

        // Same message
        expect(consoleLog.message).toBe(msg);
        expect(pinoLog.message).toBe(msg);

        // Same context
        expect(consoleLog.context).toBe('TestController');
        expect(pinoLog.context).toBe('TestController');

        // Both have stack field
        expect(typeof consoleLog.stack).toBe('string');
        expect(typeof pinoLog.stack).toBe('string');
        expect(consoleLog.stack).toContain('at Object');
        expect(pinoLog.stack).toContain('at Object');

        // Same level
        expect(consoleLog.level).toBe('error');
        expect(pinoLog.level).toBe('error');
      });

      it('NestJS exception handler produces same structure', async () => {
        const msg = Math.random().toString();

        // NestJS's BaseExceptionFilter calls: Logger.error(exception)
        // Logger (with context 'ExceptionsHandler') forwards as:
        //   error(exception, undefined, 'ExceptionsHandler')
        const error = new Error(msg);
        const consoleLogs = captureConsoleLoggerOutput((logger) => {
          logger.error(error, undefined as any, 'ExceptionsHandler');
        });

        @Controller('/')
        class TestController {
          @Get()
          get() {
            throw new Error(msg);
          }
        }

        const pinoLogs = await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
        })
          .useLoggerClass(NativeLogger)
          .forRoot({ pinoHttp: nativeLoggerOptions })
          .expectError(500)
          .run();

        const consoleLog = consoleLogs[0]!;
        const pinoLog = pinoLogs.find(
          (v) => typeof v.message === 'string' && v.message.includes(msg),
        )!;

        expect(consoleLogs).toHaveLength(1);
        expect(pinoLog).toBeTruthy();

        // Both have error message+stack in the message field (no separate stack)
        expect(typeof consoleLog.message).toBe('string');
        expect(typeof pinoLog.message).toBe('string');
        expect((consoleLog.message as string).includes(msg)).toBe(true);
        expect((pinoLog.message as string).includes(msg)).toBe(true);

        // No separate stack field
        expect(consoleLog.stack).toBeUndefined();
        expect(pinoLog.stack).toBeUndefined();

        expect(consoleLog.level).toBe('error');
        expect(pinoLog.level).toBe('error');
      });

      it('object message includes object fields', async () => {
        const key = Math.random().toString();
        const val = Math.random().toString();

        const consoleLogs = captureConsoleLoggerOutput((logger) => {
          logger.log({ [key]: val });
        });

        @Controller('/')
        class TestController {
          private readonly logger = new Logger(TestController.name);
          @Get()
          get() {
            this.logger.log({ [key]: val });
            return {};
          }
        }

        const pinoLogs = await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
        })
          .useLoggerClass(NativeLogger)
          .forRoot({ pinoHttp: nativeLoggerOptions })
          .run();

        const consoleLog = consoleLogs[0]!;
        const pinoLog = pinoLogs.find(
          (v) =>
            typeof v.message === 'object' &&
            (v.message as Record<string, unknown>)[key] === val &&
            v.context === 'TestController',
        )!;

        expect(consoleLogs).toHaveLength(1);
        expect(pinoLog).toBeTruthy();

        // Both put the object in the message field
        expect(consoleLog.message[key]).toBe(val);
        expect((pinoLog.message as Record<string, unknown>)[key]).toBe(val);

        // Both have context
        expect(consoleLog.context).toBe('TestController');
        expect(pinoLog.context).toBe('TestController');
      });

      // This is the one shape that changed between NestJS 11 and 12: an object
      // passed after the message used to become an entry of its own, and is now
      // collected under `params` on a single entry. The assertions below stay
      // deliberately version-agnostic — whatever ConsoleLogger does on the
      // installed version is the expectation — so that a future change upstream
      // turns this spec red instead of silently drifting.
      it('object after the message matches ConsoleLogger', async () => {
        const msg = Math.random().toString();
        const key = Math.random().toString();
        const val = Math.random().toString();

        const consoleLogs = captureConsoleLoggerOutput((logger) => {
          logger.log(msg, { [key]: val }, 'TestController');
        });

        @Controller('/')
        class TestController {
          private readonly logger = new Logger(TestController.name);
          @Get()
          get() {
            // NestJS Logger forwards: log(msg, {key: val}, 'TestController')
            this.logger.log(msg, { [key]: val });
            return {};
          }
        }

        const pinoLogs = await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
        })
          .useLoggerClass(NativeLogger)
          .forRoot({ pinoHttp: nativeLoggerOptions })
          .run();

        // Only the controller's own entries: request/response logs have no
        // context of their own.
        const appLogs = pinoLogs.filter((v) => v.context === 'TestController');

        // Same number of entries, in the same order, carrying the same payload.
        expect(appLogs).toHaveLength(consoleLogs.length);
        consoleLogs.forEach((consoleLog, i) => {
          expect(appLogs[i]!.message).toStrictEqual(consoleLog.message);
          expect(appLogs[i]!.params).toStrictEqual(consoleLog.params);
        });
      });

      // `flattenParams` does not exist before NestJS 12; on v11 NativeLogger
      // logs an entry per argument and there is nothing to compare against.
      it.skipIf(!hasStructuredParams)(
        'flattenParams matches ConsoleLogger',
        async () => {
          const msg = Math.random().toString();
          const key = Math.random().toString();
          const val = Math.random().toString();

          const consoleLogs = captureConsoleLoggerOutput(
            (logger) => {
              logger.log(msg, { [key]: val }, 'TestController');
            },
            { flattenParams: true },
          );

          @Controller('/')
          class TestController {
            private readonly logger = new Logger(TestController.name);
            @Get()
            get() {
              this.logger.log(msg, { [key]: val });
              return {};
            }
          }

          const pinoLogs = await new TestCase(new PlatformAdapter(), {
            controllers: [TestController],
          })
            .useLoggerClass(NativeLogger)
            .forRoot({
              pinoHttp: nativeLoggerOptions,
              nativeLogger: { flattenParams: true },
            })
            .run();

          const consoleLog = consoleLogs[0]!;
          const pinoLog = pinoLogs.find((v) => v.message === msg)!;

          expect(consoleLogs).toHaveLength(1);
          expect(pinoLog).toBeTruthy();

          // The object is spread into the root of the entry ...
          expect(consoleLog[key]).toBe(val);
          expect(pinoLog[key]).toBe(val);

          // ... and there is no `params` wrapper left on either side.
          expect(consoleLog.params).toBeUndefined();
          expect(pinoLog.params).toBeUndefined();

          expect(consoleLog.context).toBe('TestController');
          expect(pinoLog.context).toBe('TestController');
        },
      );
    });
  }
});
