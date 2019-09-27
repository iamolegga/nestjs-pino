import { NestFactory, AbstractHttpAdapter } from "@nestjs/core";
import {
  Module,
  INestApplication,
  Controller,
  Get,
  Injectable,
  Type
} from "@nestjs/common";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { ExpressAdapter } from "@nestjs/platform-express";
import MemoryStream from "memorystream";
import request from "supertest";
import pino from "pino";
import { Logger, LoggerModule } from "./";

type LogObject = {
  msg: string;
  req?: { id: number };
};

const platforms: Type<AbstractHttpAdapter<any, any, any>>[] = [
  ExpressAdapter,
  FastifyAdapter
];

const methods: [keyof Logger, pino.Level][] = [
  ["verbose", "trace"],
  ["debug", "debug"],
  ["log", "info"],
  ["warn", "warn"],
  ["error", "error"]
];

describe("methods", () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      for (const [loggerMethodName, pinoLevel] of methods) {
        it(loggerMethodName, async () => {
          const stream = new MemoryStream();
          const serviceLogMessage = Math.random().toString();
          const outOfContextLogMessage = Math.random().toString();
          let logs = "";

          stream.on("data", (chunk: string) => {
            logs += chunk.toString();
          });

          @Injectable()
          class TestService {
            constructor(private readonly logger: Logger) {}
            someMethod() {
              this.logger[loggerMethodName](serviceLogMessage);
            }
          }

          @Controller("/")
          class TestController {
            constructor(private readonly service: TestService) {}
            @Get()
            get() {
              this.service.someMethod();
              return {};
            }
          }

          @Module({
            imports: [LoggerModule.forRoot({ level: pinoLevel }, stream)],
            controllers: [TestController],
            providers: [TestService]
          })
          class TestModule {}

          const app = await NestFactory.create(
            TestModule,
            new PlatformAdapter(),
            { logger: false }
          );
          const server = app.getHttpServer();

          const logger = app.get(Logger);

          await app.init();

          // issue with fastify testing, requires extra check for readiness
          // https://github.com/nestjs/nest/issues/1817#issuecomment-484217002
          if (PlatformAdapter === FastifyAdapter) {
            const instance = app.getHttpAdapter().getInstance();
            if (instance && typeof instance.ready === "function") {
              await instance.ready();
            }
          }

          await request(server).get("/");

          logger[loggerMethodName](outOfContextLogMessage);

          await app.close();

          const parsedLogs = parseLogs(logs);

          const serviceLogObject = parsedLogs.find(
            v => v.msg === serviceLogMessage && v.req
          );
          const outOfContextLogObject = parsedLogs.find(
            v => v.msg === outOfContextLogMessage && !v.req
          );
          expect(serviceLogObject).toBeTruthy();
          expect(outOfContextLogObject).toBeTruthy();
        });
      }
    });
  }
});

describe("request context", () => {
  let stream: MemoryStream;
  let app: INestApplication;
  let random: string;
  let parsedLogs: LogObject[];

  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      beforeAll(async () => {
        stream = new MemoryStream();
        random = Math.random().toString();
        let logs = "";

        stream.on("data", (chunk: string) => {
          logs += chunk.toString();
        });

        @Injectable()
        class TestService {
          constructor(private readonly logger: Logger) {}
          someMethod() {
            this.logger.log(random);
          }
        }

        @Controller("/")
        class TestController {
          constructor(private readonly service: TestService) {}
          @Get()
          get() {
            this.service.someMethod();
            return {};
          }
        }

        @Module({
          imports: [LoggerModule.forRoot(stream)],
          controllers: [TestController],
          providers: [TestService, Logger]
        })
        class TestModule {}

        app = await NestFactory.create(TestModule, new PlatformAdapter(), {
          logger: new Logger()
        });
        const server = app.getHttpServer();

        await app.init();

        // issue with fastify testing, requires extra check for readiness
        // https://github.com/nestjs/nest/issues/1817#issuecomment-484217002
        if (PlatformAdapter === FastifyAdapter) {
          const instance = app.getHttpAdapter().getInstance();
          if (instance && typeof instance.ready === "function") {
            await instance.ready();
          }
        }

        await request(server).get("/");
        await app.close();
        parsedLogs = parseLogs(logs);
      });

      it("should log on response", () => {
        const responseLogObject = parsedLogs.find(
          log => log.msg === "request completed"
        );
        expect(responseLogObject).toBeTruthy();
      });

      it("should log with context", () => {
        const serviceLogObject = parsedLogs.find(log => log.msg === random);
        expect(serviceLogObject).toHaveProperty("req");
      });

      it("should work as nest application logger", () => {
        const nestAppLog = parsedLogs.find(log =>
          log.msg.includes("Nest application successfully started")
        );
        expect(nestAppLog).toBeTruthy();
      });
    });
  }
});

describe("passed logger", () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      it("should be used", async () => {
        const stream = new MemoryStream();
        const random = Math.random().toString();
        let logs = "";

        stream.on("data", (chunk: string) => {
          logs += chunk.toString();
        });

        @Injectable()
        class TestService {
          constructor(private readonly logger: Logger) {}
          someMethod() {
            this.logger.log(random);
          }
        }

        @Controller("/")
        class TestController {
          constructor(private readonly service: TestService) {}
          @Get("/")
          get() {
            this.service.someMethod();
            return {};
          }
        }

        @Module({
          imports: [LoggerModule.forRoot({ logger: pino(stream) })],
          controllers: [TestController],
          providers: [TestService, Logger]
        })
        class TestModule {}

        const app = await NestFactory.create(TestModule, {
          logger: new Logger()
        });
        const server = app.getHttpServer();

        await app.init();

        // issue with fastify testing, requires extra check for readiness
        // https://github.com/nestjs/nest/issues/1817#issuecomment-484217002
        if (PlatformAdapter === FastifyAdapter) {
          const instance = app.getHttpAdapter().getInstance();
          if (instance && typeof instance.ready === "function") {
            await instance.ready();
          }
        }

        await request(server).get("/");
        await app.close();

        const parsedLogs = parseLogs(logs);
        const serviceLogObject = parsedLogs.find(v => v.msg === random);
        expect(serviceLogObject).toBeTruthy();
      });
    });
  }
});

function parseLogs(logs: string): LogObject[] {
  return logs
    .split("\n")
    .map(v => v.trim())
    .filter(v => !!v)
    .map(v => JSON.parse(v));
}
