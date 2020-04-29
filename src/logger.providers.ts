import { Provider } from '@nestjs/common';

import { getLoggerToken } from './common';
import { decoratedLoggers } from './common/decorated-loggers';
import { LOGGER_OPTIONS } from './constants';
import { LoggerOptions } from './interfaces';
import { Logger, PinoLogger } from './services';

export function createLoggerProviders(options: LoggerOptions) {
  return [
    Logger,
    ...createProvidersForDecorated(),
    PinoLogger,
    {
      provide: LOGGER_OPTIONS,
      useValue: options,
    },
  ];
}

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
