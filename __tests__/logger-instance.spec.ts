import { NestFactory } from "@nestjs/core";
import { Module, Controller, Get } from "@nestjs/common";
import MemoryStream = require("memorystream");
import * as request from "supertest";
import { PinoLogger, InjectPinoLogger, LoggerModule } from "../src";
import { platforms } from "./utils/platforms";
import { fastifyExtraWait } from "./utils/fastifyExtraWait";
import { __resetOutOfContextForTests } from "../src/PinoLogger";

describe("getting the logger instance", () => {
  beforeEach(() => __resetOutOfContextForTests());

  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      it("logger is publicly accessible", async () => {
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
            return {
              constructorName: this.logger.logger.constructor.name,
            };
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

        const response = await request(server).get("/");
        expect(response.body.constructorName).toEqual("Pino");

        await app.close();
      });
    });
  }
});
