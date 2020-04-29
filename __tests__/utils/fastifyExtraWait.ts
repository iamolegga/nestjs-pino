import { Adapter } from './platforms';
import { INestApplication } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';

// issue with fastify testing, requires extra check for readiness
// https://github.com/nestjs/nest/issues/1817#issuecomment-484217002
export async function fastifyExtraWait(
  adapter: Adapter,
  app: INestApplication
) {
  if (adapter === FastifyAdapter) {
    const instance = app.getHttpAdapter().getInstance();
    if (instance && typeof instance.ready === 'function') {
      await instance.ready();
    }
  }
}
