import { Test } from '@nestjs/testing';

import { getLoggerToken, InjectPinoLogger, PinoLogger } from '../src';

describe('get-logger-token', () => {
  it('should work', async () => {
    class MyService {
      constructor(
        // biome-ignore lint/correctness/noUnusedPrivateClassMembers: the test asserts the decorated parameter resolves against getLoggerToken, so it is never read
        @InjectPinoLogger(MyService.name) private readonly logger: PinoLogger,
      ) {}
    }

    await Test.createTestingModule({
      providers: [
        MyService,
        {
          provide: getLoggerToken(MyService.name),
          useValue: {},
        },
      ],
    }).compile();
  });
});
