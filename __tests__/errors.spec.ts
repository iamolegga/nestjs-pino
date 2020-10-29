import { NestFactory } from "@nestjs/core";
import { Module, Controller, Get } from "@nestjs/common";
import MemoryStream = require("memorystream");
import * as request from "supertest";
import { PinoLogger, InjectPinoLogger, LoggerModule } from "../src";
import { platforms } from "./utils/platforms";
import { fastifyExtraWait } from "./utils/fastifyExtraWait";
import { parseLogs } from "./utils/logs";
import { __resetOutOfContextForTests } from "../src/PinoLogger";

describe("error logging", () => {
  beforeEach(() => __resetOutOfContextForTests());

  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      it("direct error passing", async () => {
        const stream = new MemoryStream();
        const context = Math.random().toString();
        let logs = "";

        stream.on("data", (chunk: string) => {
          logs += chunk.toString();
        });

        @Controller("/")
        class TestController {
          constructor(
            @InjectPinoLogger(context) private readonly logger: PinoLogger
          ) {}
          @Get()
          get() {
            this.logger.info(new Error('direct error passing'));
            return {};
          }
        }

        @Module({
          imports: [LoggerModule.forRoot({ pinoHttp: stream })],
          controllers: [TestController],
        })
        class TestModule {}

        const app = await NestFactory.create(
          TestModule,
          new PlatformAdapter(),
          { logger: false }
        );
        const server = app.getHttpServer();

        await app.init();
        await fastifyExtraWait(PlatformAdapter, app);

        await request(server).get("/");

        await app.close();

        const parsedLogs = parseLogs(logs);

        const errorLogObject = parsedLogs.find(
          v =>
            v.req &&
            v.context === context &&
            (v as any).err
        );
        expect(errorLogObject).toBeTruthy();
      });
    });
  }
});
