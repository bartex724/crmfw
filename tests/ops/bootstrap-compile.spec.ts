import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';

describe('Bootstrap compile smoke', () => {
  let app: INestApplicationContext | undefined;

  it('imports and compiles AppModule without boot failure', async () => {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: false
    });

    expect(app).toBeDefined();
  });

  it('runs test process in non-watch mode', () => {
    expect(process.argv).not.toContain('--watch');
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});
