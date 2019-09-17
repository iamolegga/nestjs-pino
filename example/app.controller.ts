import { Controller, Get } from "@nestjs/common";
import { MyService } from "./my.service";
import { Logger } from "../src";

@Controller()
export class AppController {
  constructor(
    private readonly myService: MyService,
    private readonly logger: Logger
  ) {}

  @Get()
  getHello(): string {
    this.logger.log("calling AppController.getHello");
    return `Hello ${this.myService.getWorld()}`;
  }
}
