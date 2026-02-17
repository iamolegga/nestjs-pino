/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConsoleLogger, Controller, Get, Logger } from '@nestjs/common';

import { NativeLogger, nativeLoggerOptions } from '../src';

import { platforms } from './utils/platforms';
import { TestCase } from './utils/test-case';

// ConsoleLogger's { json: true } option is only available in NestJS v11+.
// Detect support at runtime by checking if a test log produces JSON output.
const supportsJson = (() => {
  let produced = '';
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string) => {
    if (typeof chunk === 'string') produced += chunk;
    return true;
  }) as typeof process.stdout.write;
  try {
    new ConsoleLogger('_probe', { json: true } as any).log('_probe');
  } finally {
    process.stdout.write = orig;
  }
  try {
    JSON.parse(produced);
    return true;
  } catch {
    return false;
  }
})();

// Helper to capture ConsoleLogger JSON output by intercepting stdout/stderr
function captureConsoleLoggerOutput(
  fn: (logger: ConsoleLogger) => void,
): Record<string, any>[] {
  const captured: string[] = [];

  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = ((chunk: string) => {
    if (typeof chunk === 'string' && chunk.startsWith('{')) {
      captured.push(chunk.trim());
    }
    return true;
  }) as typeof process.stdout.write;

  process.stderr.write = ((chunk: string) => {
    if (typeof chunk === 'string' && chunk.startsWith('{')) {
      captured.push(chunk.trim());
    }
    return true;
  }) as typeof process.stderr.write;

  try {
    const logger = new ConsoleLogger('TestController', { json: true } as any);
    fn(logger);
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }

  return captured.map((line) => JSON.parse(line));
}

(supportsJson ? describe : describe.skip)(
  'NativeLogger vs ConsoleLogger comparison',
  () => {
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
            (v) =>
              typeof v.message === 'string' &&
              (v.message as string).includes(msg),
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
      });
    }
  },
);
