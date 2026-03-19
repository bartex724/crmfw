import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/crm?schema=public';

describe('Health readiness', () => {
  let app: INestApplication;
  const prismaMock = {
    probe: jest.fn<Promise<void>, []>()
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  it('returns live status without database dependency', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({ status: 'live' });
  });

  it('returns ready when PostgreSQL probe succeeds', async () => {
    prismaMock.probe.mockResolvedValueOnce();

    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect({ status: 'ready' });

    expect(prismaMock.probe).toHaveBeenCalledTimes(1);
  });

  it('returns service unavailable when PostgreSQL probe fails', async () => {
    prismaMock.probe.mockRejectedValueOnce(new Error('connection failed'));

    const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

    expect(response.body).toMatchObject({
      statusCode: 503
    });
    expect(prismaMock.probe).toHaveBeenCalledTimes(1);
  });
});
