import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import type { Response } from 'express';

@Controller()
export class AppController {
  @Get()
  root(): Record<string, string> {
    return {
      name: 'crm-api',
      status: 'ok',
      health: '/health/live'
    };
  }

  @Get('favicon.ico')
  @HttpCode(204)
  favicon(@Res() response: Response): void {
    response.send();
  }
}
