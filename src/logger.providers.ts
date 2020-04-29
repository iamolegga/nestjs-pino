import { Provider } from '@nestjs/common';

import { getLoggerToken } from './common';
import { decoratedLoggers } from './common/decorated-loggers';
import { PinoLogger } from './services';

function createDecoratedLoggerProvider(context: string): Provider<PinoLogger> {
  return {
    provide: getLoggerToken(context),
    useFactory: (logger: PinoLogger) => {
      logger.setContext(context);
      return logger;
    },
    inject: [PinoLogger],
  };
}

export function createProvidersForDecorated(): Provider<PinoLogger>[] {
  return [...decoratedLoggers.values()].map((context) =>
    createDecoratedLoggerProvider(context),
  );
}
