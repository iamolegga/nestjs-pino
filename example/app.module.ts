import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { LoggerModule } from "../src";
import { MyService } from "./my.service";

@Module({
  imports: [LoggerModule.forRoot()],
  controllers: [AppController],
  providers: [MyService]
})
export class AppModule {}
