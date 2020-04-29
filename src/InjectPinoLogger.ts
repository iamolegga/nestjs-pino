import { Inject, Provider } from '@nestjs/common';

import { PinoLogger } from './services';

const decoratedTokenPrefix = 'PinoLogger:';

const decoratedLoggers = new Set<string>();

export function InjectPinoLogger(context = '') {
  decoratedLoggers.add(context);
  return Inject(getLoggerToken(context));
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

export function getLoggerToken(context: string): string {
  return `${decoratedTokenPrefix}${context}`;
}
