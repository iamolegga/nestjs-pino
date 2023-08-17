import { NestFactory } from '@nestjs/core';

import { Logger } from '../src';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  await app.listen(3000);
}

bootstrap().catch(console.error);
