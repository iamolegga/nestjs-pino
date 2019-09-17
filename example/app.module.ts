import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { Logger } from "../src";
import { MyService } from "./my.service";
import { Config } from "./config.service";

@Module({
  controllers: [AppController],
  providers: [MyService, Logger, Config]
})
export class AppModule {}
