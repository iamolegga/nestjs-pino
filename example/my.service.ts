import { Injectable } from "@nestjs/common";

@Injectable()
export class MyService {
  getWorld() {
    return "World!";
  }
}
