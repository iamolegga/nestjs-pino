import { Module } from '@nestjs/common';

import { LoggerModule } from '../src';

import { AppController } from './app.controller';
import { MyService } from './my.service';

@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: { level: process.env.LOG_LEVEL } }),
  ],
  controllers: [AppController],
  providers: [MyService],
})
export class AppModule {}
