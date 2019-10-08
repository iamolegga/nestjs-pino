import { NestFactory } from "@nestjs/core";
import { Module, Controller, Get, Injectable } from "@nestjs/common";
import MemoryStream from "memorystream";
import request from "supertest";
import pino from "pino";
import { Logger, LoggerModule } from "../src";
import { platforms } from "./utils/platforms";
import { fastifyExtraWait } from "./utils/fastifyExtraWait";
import { parseLogs } from "./utils/logs";

const methods: [keyof Logger, pino.Level][] = [
  ["verbose", "trace"],
  ["debug", "debug"],
  ["log", "info"],
  ["warn", "warn"],
  ["error", "error"]
];

describe("levels", () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      for (const [loggerMethodName, pinoLevel] of methods) {
        it(loggerMethodName, async () => {
          const stream = new MemoryStream();
          const serviceLogMessage = Math.random().toString();
          const appLogMessage = "Nest application successfully started";
          let logs = "";
          const trace = "trace";

          stream.on("data", (chunk: string) => {
            logs += chunk.toString();
          });

          @Injectable()
          class TestService {
            constructor(private readonly logger: Logger) {}
            someMethod() {
              if (loggerMethodName === "error") {
                this.logger[loggerMethodName](
                  serviceLogMessage,
                  trace,
                  TestService.name
                );
                this.logger[loggerMethodName](serviceLogMessage, trace);
              } else {
                this.logger[loggerMethodName](
                  serviceLogMessage,
                  TestService.name
                );
              }
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
          app.useLogger(app.get(Logger));
          const server = app.getHttpServer();

          await app.init();
          await fastifyExtraWait(PlatformAdapter, app);

          await request(server).get("/");

          await app.close();

          const parsedLogs = parseLogs(logs);

          const serviceLogObject = parsedLogs.find(
            v => v.msg === serviceLogMessage && v.req && !v.context && !v.trace
          );
          expect(serviceLogObject).toBeTruthy();

          if (pinoLevel === "error") {
            const serviceLogObjectWithTrace = parsedLogs.find(
              v => v.msg === serviceLogMessage && v.req && !v.context && v.trace
            );
            expect(serviceLogObjectWithTrace).toBeTruthy();
            const serviceLogObjectWithTraceAndCtx = parsedLogs.find(
              v => v.msg === serviceLogMessage && v.req && v.context && v.trace
            );
            expect(serviceLogObjectWithTraceAndCtx).toBeTruthy();
          } else {
            const serviceLogObjectWithContext = parsedLogs.find(
              v => v.msg === serviceLogMessage && v.req && v.context && !v.trace
            );
            expect(serviceLogObjectWithContext).toBeTruthy();
          }

          const responseLogObject = parsedLogs.find(
            log => log.msg === "request completed"
          );
          expect(responseLogObject)[
            pinoLevel === "warn" || pinoLevel === "error"
              ? "toBeFalsy"
              : "toBeTruthy"
          ]();

          // Because of nest itself logs has level "info"
          // logs of it are not always exists
          const appLogObject = parsedLogs.find(log =>
            log.msg.startsWith(appLogMessage)
          );
          if (pinoLevel === "warn" || pinoLevel === "error") {
            expect(appLogObject).toBeFalsy();
          } else {
            expect(appLogObject).toBeTruthy();
          }
        });
      }
    });
  }
});
