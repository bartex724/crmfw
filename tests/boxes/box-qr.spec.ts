import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AccessModule } from '../../src/access/access.module';
import { AuthService, SessionAuthGuard } from '../../src/auth/auth.service';
import { AuditService } from '../../src/audit/audit.service';
import { BoxesController } from '../../src/boxes/boxes.controller';
import { BoxesService } from '../../src/boxes/boxes.service';
import { APP_CONFIG } from '../../src/config/config.module';
import { buildConfiguration } from '../../src/config/configuration';
import { PrismaService } from '../../src/database/prisma.service';

type BoxRecord = {
  id: string;
  boxCode: string;
  name: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function makeBox(id: string, boxCode: string): BoxRecord {
  const now = new Date('2026-03-19T00:00:00.000Z');
  return {
    id,
    boxCode,
    name: boxCode,
    notes: null,
    createdAt: now,
    updatedAt: now
  };
}

function createQrHarness(seedBoxes: BoxRecord[] = []) {
  const boxes = [...seedBoxes];

  return {
    prisma: {
      box: {
        findFirst: jest.fn(
          async ({
            where
          }: {
            where: {
              boxCode?: {
                equals: string;
                mode?: 'insensitive';
              };
            };
          }) => {
            const target = where.boxCode?.equals.toLowerCase() ?? '';
            const box = boxes.find((entry) => entry.boxCode.toLowerCase() === target) ?? null;
            return box ? { ...box } : null;
          }
        )
      }
    },
    boxes
  };
}

function baseEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    IMAGE_STORAGE_DRIVER: 'local',
    IMAGE_STORAGE_LOCAL_PATH: './tmp/local-images'
  };
}

describe('Box QR configuration', () => {
  it('requires APP_PUBLIC_BASE_URL', () => {
    expect(() =>
      buildConfiguration({
        ...baseEnv()
      })
    ).toThrow(/APP_PUBLIC_BASE_URL/);
  });

  it('normalizes trailing slash in APP_PUBLIC_BASE_URL', () => {
    const config = buildConfiguration({
      ...baseEnv(),
      APP_PUBLIC_BASE_URL: 'https://example.test/public/'
    });

    expect((config as Record<string, unknown>).publicBaseUrl).toBe('https://example.test/public');
  });
});

describe('Box QR generation', () => {
  const canonicalPathContract = '/boxes/{boxCode}/scan';
  const previousNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('returns unique payload URLs and qr data urls per box', async () => {
    const harness = createQrHarness([makeBox('box-1', 'BX-001'), makeBox('box-2', 'BX-002')]);
    const moduleFixture = await Test.createTestingModule({
      providers: [
        BoxesService,
        {
          provide: PrismaService,
          useValue: harness.prisma
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn(async () => undefined) }
        },
        {
          provide: APP_CONFIG,
          useValue: { publicBaseUrl: 'https://app.example.test' }
        }
      ]
    }).compile();

    const service = moduleFixture.get(BoxesService);
    const first = await service.getBoxQr('BX-001');
    const second = await service.getBoxQr('bx-002');

    expect(canonicalPathContract).toBe('/boxes/{boxCode}/scan');
    expect(first).toMatchObject({
      boxId: 'box-1',
      boxCode: 'BX-001',
      payloadUrl: 'https://app.example.test/boxes/BX-001/scan'
    });
    expect(second).toMatchObject({
      boxId: 'box-2',
      boxCode: 'BX-002',
      payloadUrl: 'https://app.example.test/boxes/BX-002/scan'
    });
    expect(first.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(second.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(first.qrDataUrl).not.toBe(second.qrDataUrl);

    await moduleFixture.close();
  });

  it('throws not found for missing box code', async () => {
    const harness = createQrHarness([makeBox('box-1', 'BX-001')]);
    const moduleFixture = await Test.createTestingModule({
      providers: [
        BoxesService,
        {
          provide: PrismaService,
          useValue: harness.prisma
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn(async () => undefined) }
        },
        {
          provide: APP_CONFIG,
          useValue: { publicBaseUrl: 'https://app.example.test' }
        }
      ]
    }).compile();

    const service = moduleFixture.get(BoxesService);
    await expect(service.getBoxQr('BX-999')).rejects.toThrow('Box not found');

    await moduleFixture.close();
  });

  describe('Box QR endpoint', () => {
    let app: INestApplication;

    beforeEach(async () => {
      const harness = createQrHarness([makeBox('box-1', 'BX-001')]);
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AccessModule],
        controllers: [BoxesController],
        providers: [
          SessionAuthGuard,
          BoxesService,
          {
            provide: PrismaService,
            useValue: harness.prisma
          },
          {
            provide: AuditService,
            useValue: {
              record: jest.fn(async () => undefined)
            }
          },
          {
            provide: AuthService,
            useValue: {
              getAuthenticatedUserFromToken: jest.fn()
            }
          },
          {
            provide: APP_CONFIG,
            useValue: { publicBaseUrl: 'https://app.example.test' }
          }
        ]
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it('exposes GET /boxes/:boxCode/qr', async () => {
      await request(app.getHttpServer())
        .get('/boxes/BX-001/qr')
        .set({ 'x-test-role': 'WAREHOUSE_STAFF' })
        .expect(200)
        .expect((response) => {
          expect(response.body.box.boxCode).toBe('BX-001');
          expect(response.body.box.payloadUrl).toBe('https://app.example.test/boxes/BX-001/scan');
          expect(response.body.box.qrDataUrl).toMatch(/^data:image\/png;base64,/);
        });
    });

    it('returns 404 when box code is unknown', async () => {
      await request(app.getHttpServer())
        .get('/boxes/BX-999/qr')
        .set({ 'x-test-role': 'WAREHOUSE_STAFF' })
        .expect(404)
        .expect((response) => {
          expect(response.body.message).toContain('Box not found');
        });
    });
  });
});
