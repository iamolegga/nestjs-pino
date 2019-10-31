import { NestFactory } from "@nestjs/core";
import {
  Module,
  Controller,
  Get,
  Injectable,
  OnModuleInit
} from "@nestjs/common";
import MemoryStream = require("memorystream");
import * as request from "supertest";
import { Logger, LoggerModule } from "../src";
import { fastifyExtraWait } from "./utils/fastifyExtraWait";
import { parseLogs } from "./utils/logs";
import { __resetOutOfContextForTests } from "../src/PinoLogger";
import { FastifyAdapter } from "@nestjs/platform-fastify";

describe("useExisting property", () => {
  beforeEach(() => __resetOutOfContextForTests());

  describe(FastifyAdapter.name, () => {
    it("should use adapter logger in req context and dafault beyond", async () => {
      const stream = new MemoryStream();
      const random = Math.random().toString();
      const moduleInitMessage = "module initiated";
      let logs = "";

      stream.on("data", (chunk: string) => {
        logs += chunk.toString();
      });

      @Injectable()
      class TestService implements OnModuleInit {
        constructor(private readonly logger: Logger) {}
        someMethod() {
          this.logger.log(random);
        }
        onModuleInit() {
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
        imports: [LoggerModule.forRoot({ useExisting: true })],
        controllers: [TestController],
        providers: [TestService]
      })
      class TestModule {}

      const app = await NestFactory.create(
        TestModule,
        new FastifyAdapter({ logger: stream }),
        { logger: false }
      );
      const server = app.getHttpServer();

      await app.init();
      await fastifyExtraWait(FastifyAdapter, app);
      await request(server).get("/");
      await app.close();

      const parsedLogs = parseLogs(logs);

      const serviceLogObject = parsedLogs.find(v => v.msg === random);
      expect(serviceLogObject).toBeTruthy();

      const moduleInitLogObject = parsedLogs.find(
        v => v.msg === moduleInitMessage
      );
      expect(moduleInitLogObject).toBeFalsy();
    });
  });
});
