import { Controller, Get } from '@nestjs/common';
import { MyService } from './my.service';
import { PinoLogger } from '../src';

@Controller()
export class AppController {
  constructor(
    private readonly myService: MyService,
    private readonly logger: PinoLogger
  ) {
    logger.setContext(AppController.name);
  }

  @Get()
  getHello(): string {
    this.logger.info('getHello(%O)', arguments);
    return `Hello ${this.myService.getWorld()}`;
  }
}
