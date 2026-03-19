import { Controller, Get, Header, HttpCode, Res } from '@nestjs/common';
import type { Response } from 'express';
import { renderMvpPage } from './frontend/mvp.page';

@Controller()
export class AppController {
  @Get()
  @Header('content-type', 'text/html; charset=utf-8')
  root(): string {
    return renderMvpPage();
  }

  @Get('api')
  info(): Record<string, string> {
    return {
      name: 'crm-api',
      status: 'ok',
      ui: '/',
      health: '/health/live'
    };
  }

  @Get('favicon.ico')
  @HttpCode(204)
  favicon(@Res() response: Response): void {
    response.send();
  }
}
