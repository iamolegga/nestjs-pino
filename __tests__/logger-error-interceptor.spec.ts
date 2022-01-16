import { Controller, Get } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerErrorInterceptor } from '../src';
import { platforms } from './utils/platforms';
import { TestCase } from './utils/test-case';

describe('error intercepting', () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      it('logger is publicly accessible', async () => {
        class CustomError extends Error {
          constructor(message?: string) {
            super(message);
            Object.setPrototypeOf(this, new.target.prototype);
            Error.captureStackTrace(this, this.constructor);
          }
        }

        @Controller('/')
        class TestController {
          @Get()
          get() {
            throw new CustomError('Test Error Message');
          }
        }

        const result = await new TestCase(new PlatformAdapter(), {
          controllers: [TestController],
          providers: [
            { provide: APP_INTERCEPTOR, useClass: LoggerErrorInterceptor },
          ],
        })
          .forRoot()
          .expectError(500)
          .run();

        expect(
          result.find((log) => log.msg === 'request errored'),
        ).toMatchObject({
          err: {
            message: 'Test Error Message',
            type: 'CustomError',
          },
        });
      });
    });
  }
});
