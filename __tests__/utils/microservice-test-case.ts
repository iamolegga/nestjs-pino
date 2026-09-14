import {
  type INestApplication,
  type INestMicroservice,
  Module,
  type ModuleMetadata,
  type Type,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  type ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { ExpressAdapter } from '@nestjs/platform-express';
import MemoryStream from 'memorystream';
import type pino from 'pino';
import type { Options } from 'pino-http';

import {
  Logger,
  LoggerModule,
  type Params,
  registerMicroserviceLogging,
} from '../../src';
import { __resetOutOfContextForTests as __resetSingletons } from '../../src/PinoLogger';

import { getFreePort } from './get-free-port';
import { LogsContainer } from './logs';

/**
 * TCP is the only transport `@nestjs/microservices` implements without an
 * external broker, so it is what the end-to-end specs run on. Anything
 * transport-specific is covered by the unit specs, which drive the hook with a
 * synthetic `ExecutionContext` instead.
 */
export class MicroserviceTestCase {
  private readonly stream: pino.DestinationStream;
  private module?: Type<unknown>;
  private params: Params = {};

  constructor(private readonly moduleMetadata: ModuleMetadata) {
    this.stream = new MemoryStream('', { readable: false });
  }

  forRoot(params: Params = {}): this {
    this.params = this.injectStream(params);
    return this;
  }

  /**
   * Runs a standalone microservice application. With `manualHook` the module is
   * left to not register anything and the hook is taken from the container by
   * its token instead, the way a hybrid application without `inheritAppConfig`
   * has to.
   */
  async run(
    interact: (client: ClientProxy) => Promise<unknown>,
    { manualHook = false }: { manualHook?: boolean } = {},
  ): Promise<LogsContainer> {
    return this.withApp(async (port) => {
      const app = await NestFactory.createMicroservice(this.buildModule(), {
        transport: Transport.TCP,
        options: { port },
        bufferLogs: true,
      });
      app.useLogger(app.get(Logger));
      if (manualHook) {
        registerMicroserviceLogging(app);
      }
      await app.listen();
      return app;
    }, interact);
  }

  /**
   * Runs an HTTP application with a microservice connected to it. Without
   * `inheritAppConfig` NestJS builds the microservice its own
   * `ApplicationConfig`, which is exactly the case the module cannot reach.
   */
  async runHybrid(
    interact: (client: ClientProxy) => Promise<unknown>,
    { inheritAppConfig = true }: { inheritAppConfig?: boolean } = {},
  ): Promise<LogsContainer> {
    let http: INestApplication | undefined;

    return this.withApp(async (port) => {
      http = await NestFactory.create(
        this.buildModule(),
        new ExpressAdapter(),
        {
          bufferLogs: true,
        },
      );
      http.useLogger(http.get(Logger));
      http.connectMicroservice(
        { transport: Transport.TCP, options: { port } },
        { inheritAppConfig },
      );
      await http.startAllMicroservices();
      await http.init();
      return http as unknown as INestMicroservice;
    }, interact);
  }

  private async withApp(
    start: (port: number) => Promise<INestMicroservice>,
    interact: (client: ClientProxy) => Promise<unknown>,
  ): Promise<LogsContainer> {
    __resetSingletons();

    const port = await getFreePort();
    const app = await start(port);

    const client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { port },
    });

    try {
      await client.connect();
      await interact(client);
      await this.settle();
    } finally {
      await client.close();
      await app.close();
    }

    return LogsContainer.from(this.stream);
  }

  /**
   * `emit` resolves once the event is written to the socket, not once the
   * handler is done, so the stream is given a moment to stop growing before it
   * is read.
   */
  private async settle(timeout = 2000): Promise<void> {
    const deadline = Date.now() + timeout;
    let previous = -1;

    while (Date.now() < deadline) {
      const current = (this.stream as { toString(): string }).toString().length;
      if (current > 0 && current === previous) return;
      previous = current;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  private buildModule(): Type<unknown> {
    if (this.module) return this.module;

    const params = this.params;

    @Module({
      ...this.moduleMetadata,
      imports: [
        LoggerModule.forRoot(params),
        ...(this.moduleMetadata.imports || []),
      ],
    })
    class TestModule {}

    this.module = TestModule;
    return this.module;
  }

  private injectStream(params: Params): Params {
    if (Array.isArray(params.pinoHttp)) {
      return { ...params, pinoHttp: [params.pinoHttp[0], this.stream] };
    }
    return {
      ...params,
      pinoHttp: {
        ...((params.pinoHttp as Options) || {}),
        stream: this.stream,
      },
    };
  }
}
