import type { INestApplication } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AccessModule } from '../../src/access/access.module';
import { AccessProbeController, HeaderRoleGuard } from './fixtures/access-probe.controller';

@Module({
  imports: [AccessModule],
  controllers: [AccessProbeController],
  providers: [HeaderRoleGuard]
})
class AccessProbeTestModule {}

describe('Guest restrictions', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AccessProbeTestModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows guest read access for inventory endpoint', async () => {
    await request(app.getHttpServer())
      .get('/access-probe/inventory/read')
      .set('x-role', 'GUEST')
      .expect(200);
  });

  it('denies guest write attempts to inventory, events, and boxes', async () => {
    await request(app.getHttpServer())
      .post('/access-probe/inventory/write')
      .set('x-role', 'GUEST')
      .expect(403);

    await request(app.getHttpServer())
      .post('/access-probe/events/write')
      .set('x-role', 'GUEST')
      .expect(403);

    await request(app.getHttpServer())
      .post('/access-probe/boxes/write')
      .set('x-role', 'GUEST')
      .expect(403);
  });

  it('denies guest exports access', async () => {
    await request(app.getHttpServer()).get('/access-probe/exports').set('x-role', 'GUEST').expect(403);
  });
});
