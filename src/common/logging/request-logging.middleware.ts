import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { redactSensitive } from './redaction.util';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  use(request: Request, _response: Response, next: NextFunction): void {
    const payload = {
      method: request.method,
      path: request.path,
      query: redactSensitive(request.query),
      headers: redactSensitive({
        authorization: request.headers.authorization,
        cookie: request.headers.cookie,
        'user-agent': request.headers['user-agent']
      }),
      body: redactSensitive(request.body ?? {})
    };

    console.log('[request]', JSON.stringify(payload));
    next();
  }
}
