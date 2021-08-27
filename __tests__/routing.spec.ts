import { Controller, Get, Logger, RequestMethod } from '@nestjs/common';
import { platforms } from './utils/platforms';
import { TestCase } from './utils/test-case';

describe('routing', () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      let includedMsg: string;
      let excludedMsg: string;
      let notIncludedMsg: string;
      let testCase: TestCase;

      beforeEach(async () => {
        includedMsg = Math.random().toString();
        excludedMsg = Math.random().toString();
        notIncludedMsg = Math.random().toString();

        @Controller('/')
        class LoggingController {
          private readonly logger = new Logger(LoggingController.name);

          @Get('/include')
          withLog() {
            this.logger.log(includedMsg);
            return {};
          }

          @Get('/exclude')
          skipLog() {
            this.logger.log(excludedMsg);
            return {};
          }
        }

        @Controller('/not-include')
        class NoLoggingController {
          private readonly logger = new Logger(NoLoggingController.name);

          @Get()
          get() {
            this.logger.log(notIncludedMsg);
            return {};
          }
        }

        testCase = new TestCase(new PlatformAdapter(), {
          controllers: [LoggingController, NoLoggingController],
        }).forRoot({
          forRoutes: [LoggingController],
          exclude: [{ method: RequestMethod.GET, path: '/exclude' }],
        });
      });

      it('included', async () => {
        const logs = await testCase.run('/include');
        expect(logs.some((v) => v.msg === includedMsg && !!v.req)).toBeTruthy();
        expect(logs.getResponseLog()).toBeTruthy();
      });

      it('excluded', async () => {
        const logs = await testCase.run('/exclude');
        expect(logs.some((v) => v.msg === excludedMsg && !v.req)).toBeTruthy();
        expect(logs.getResponseLog()).toBeFalsy();
      });

      it('not included', async () => {
        const logs = await testCase.run('/not-include');
        expect(
          logs.some((v) => v.msg === notIncludedMsg && !v.req),
        ).toBeTruthy();
        expect(logs.getResponseLog()).toBeFalsy();
      });
    });
  }
});
