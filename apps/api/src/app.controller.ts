import { Controller, Get } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller()
export class AppController {
  @Get()
  @AllowAnonymous()
  getRoot(): { name: string } {
    return { name: 'Helix Exchange API' };
  }
}
