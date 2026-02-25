import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot(): { name: string } {
    return { name: 'Helix Exchange API' };
  }
}
