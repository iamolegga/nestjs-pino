import { MiddlewareConsumer } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { LoggerModule, Params } from '../src';

describe('use legacy wildcard route', () => {
  let forRoutesSpy: jest.Mock;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    forRoutesSpy = jest.fn();
  });

  function createMockConsumer(): MiddlewareConsumer {
    return {
      apply: jest.fn().mockReturnThis(),
      exclude: jest.fn().mockReturnThis(),
      forRoutes: forRoutesSpy,
    } as MiddlewareConsumer;
  }

  async function createModule(params?: Params) {
    const module = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(params)],
    }).compile();

    return module;
  }

  it('should use `/{*splat}` when useLegacyWildcardRoute is false', async () => {
    moduleRef = await createModule({ useLegacyWildcardRoute: false });
    const loggerModule = moduleRef.get<LoggerModule>(LoggerModule);

    const consumer = createMockConsumer();
    loggerModule.configure(consumer);

    expect(forRoutesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/{*splat}' }),
    );
  });

  it('should use `*` when useLegacyWildcardRoute is true', async () => {
    moduleRef = await createModule({ useLegacyWildcardRoute: true });
    const loggerModule = moduleRef.get<LoggerModule>(LoggerModule);

    const consumer = createMockConsumer();
    loggerModule.configure(consumer);

    expect(forRoutesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ path: '*' }),
    );
  });
});
