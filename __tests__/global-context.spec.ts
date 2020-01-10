import { NestFactory } from "@nestjs/core";
import { Module, Controller, Get, Injectable } from "@nestjs/common";
import MemoryStream = require("memorystream");
import * as request from "supertest";
import { PinoLogger, InjectPinoLogger, LoggerModule, Logger } from "../src";
import { platforms } from "./utils/platforms";
import { fastifyExtraWait } from "./utils/fastifyExtraWait";
import { parseLogs } from "./utils/logs";
import { __resetOutOfContextForTests } from "../src/PinoLogger";
import { GlobalContext } from "../src/params";

const testCases = [
  { caseName: "should work" },
  { caseName: "global context should not be rewritten by data and context" }
];

describe("register and use global logger context", () => {
  let stream: MemoryStream;
  let serviceLogMessage: string;
  let controllerLogMessage: string;
  let serviceContext: string;
  let controllerContext: string;
  let renameContext: string;
  let globalContext: GlobalContext;
  let logs: string;

  beforeEach(async () => {
    __resetOutOfContextForTests();
    stream = new MemoryStream();
    serviceLogMessage = Math.random().toString();
    controllerLogMessage = Math.random().toString();
    serviceContext = Math.random().toString();
    controllerContext = Math.random().toString();
    globalContext = { microservice: Math.random().toString() };
    renameContext = "microservice";

    logs = "";
  });

  for (const PlatformAdapter of platforms) {
    testCases.forEach(({ caseName }, caseIndex) => {
      describe(PlatformAdapter.name, () => {
        it(caseName, async () => {
          stream.on("data", (chunk: string) => {
            logs += chunk.toString();
          });

          @Injectable()
          class TestService {
            constructor(private readonly logger: Logger) {}
            someMethod0() {
              this.logger.log(serviceLogMessage, serviceContext);
            }
            someMethod1() {
              this.logger.log(serviceLogMessage, serviceContext);
            }
          }

          @Controller("/")
          class TestController {
            constructor(
              private readonly service: TestService,
              @InjectPinoLogger(controllerContext)
              private readonly logger: PinoLogger
            ) {}
            @Get("case0")
            getCase0() {
              this.logger.info({ foo: "bar" }, controllerLogMessage);
              this.logger.info(controllerLogMessage);
              this.service.someMethod0();
              return {};
            }

            @Get("case1")
            getCase1() {
              this.logger.info(
                { microservice: "bar", foo: "bar" },
                controllerLogMessage
              );
              this.logger.info(controllerLogMessage);
              this.service.someMethod1();
              return {};
            }
          }

          @Module({
            imports: [
              LoggerModule.forRoot({
                pinoHttp: stream,
                globalContext,
                renameContext
              })
            ],
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

          await app.init();
          await fastifyExtraWait(PlatformAdapter, app);

          await request(server).get(`/case${caseIndex}`);

          await app.close();

          const parsedLogs = parseLogs(logs);

          const serviceLogObject = parsedLogs.find(
            v =>
              v.msg === serviceLogMessage &&
              v.req &&
              Object.keys(globalContext).length !== 0 &&
              Object.entries(globalContext).every(
                ([key, value]) => v[key] === value
              )
          );

          expect(serviceLogObject).toBeTruthy();

          const controllerLogObject1 = parsedLogs.find(
            v =>
              v.msg === controllerLogMessage &&
              v.req &&
              Object.keys(globalContext).length !== 0 &&
              Object.entries(globalContext).every(
                ([key, value]) => v[key] === value
              ) &&
              (v as any).foo === "bar"
          );
          const controllerLogObject2 = parsedLogs.find(
            v =>
              v.msg === controllerLogMessage &&
              v.req &&
              Object.keys(globalContext).length !== 0 &&
              Object.entries(globalContext).every(
                ([key, value]) => v[key] === value
              ) &&
              !("foo" in v)
          );
          expect(controllerLogObject1).toBeTruthy();
          expect(controllerLogObject2).toBeTruthy();
        });
      });
    });
  }
});
