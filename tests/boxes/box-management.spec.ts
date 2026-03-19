import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AccessModule } from '../../src/access/access.module';
import { AuthService, SessionAuthGuard } from '../../src/auth/auth.service';
import { AuditService } from '../../src/audit/audit.service';
import { BoxesController } from '../../src/boxes/boxes.controller';
import { BoxesService } from '../../src/boxes/boxes.service';
import { APP_CONFIG } from '../../src/config/config.module';
import { PrismaService } from '../../src/database/prisma.service';

type BoxRecord = {
  id: string;
  boxCode: string;
  name: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function createBoxesHarness() {
  const boxes: BoxRecord[] = [];

  const prisma = {
    box: {
      findMany: jest.fn(async () => boxes.map((box) => ({ ...box }))),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const box = boxes.find((entry) => entry.id === where.id);
        return box ? { ...box } : null;
      }),
      findFirst: jest.fn(
        async ({
          where
        }: {
          where: {
            id?: {
              not: string;
            };
            boxCode?: {
              equals: string;
              mode?: 'insensitive';
            };
          };
        }) => {
          const normalized = where.boxCode?.equals.toLowerCase() ?? null;
          return (
            boxes.find((entry) => {
              const idAllowed = where.id?.not ? entry.id !== where.id.not : true;
              const codeMatch = normalized
                ? entry.boxCode.toLowerCase() === normalized
                : true;
              return idAllowed && codeMatch;
            }) ?? null
          );
        }
      ),
      create: jest.fn(
        async ({
          data
        }: {
          data: {
            boxCode: string;
            name: string;
            notes: string | null;
          };
        }) => {
          const now = new Date();
          const row: BoxRecord = {
            id: `box-${boxes.length + 1}`,
            boxCode: data.boxCode,
            name: data.name,
            notes: data.notes,
            createdAt: now,
            updatedAt: now
          };
          boxes.push(row);
          return { ...row };
        }
      ),
      update: jest.fn(
        async ({
          where,
          data
        }: {
          where: { id: string };
          data: {
            boxCode?: string;
            name?: string;
            notes?: string | null;
          };
        }) => {
          const row = boxes.find((entry) => entry.id === where.id);
          if (!row) {
            throw new Error('box not found');
          }

          if (data.boxCode !== undefined) {
            row.boxCode = data.boxCode;
          }
          if (data.name !== undefined) {
            row.name = data.name;
          }
          if (data.notes !== undefined) {
            row.notes = data.notes;
          }
          row.updatedAt = new Date();
          return { ...row };
        }
      ),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const index = boxes.findIndex((entry) => entry.id === where.id);
        if (index < 0) {
          throw new Error('box not found');
        }
        const [deleted] = boxes.splice(index, 1);
        return deleted;
      })
    }
  };

  return {
    prisma,
    boxes
  };
}

describe('Box management', () => {
  it('supports create/list/get/update/delete lifecycle with id-based detail route contract', async () => {
    const harness = createBoxesHarness();
    const auditService = { record: jest.fn(async () => undefined) };
    const service = new BoxesService(harness.prisma as never, auditService as never);

    const created = await service.createBox(
      {
        boxCode: ' bx-001 ',
        name: ' Audio rack ',
        notes: '  Main rack  '
      },
      'user-1'
    );

    expect(created.boxCode).toBe('BX-001');
    expect(created.name).toBe('Audio rack');
    expect(created.notes).toBe('Main rack');

    const listed = await service.listBoxes();
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(created.id);

    const detail = await service.getBox(String(created.id));
    expect(detail.id).toBe(created.id);

    const updated = await service.updateBox(
      String(created.id),
      {
        name: ' Audio shelf ',
        notes: '   '
      },
      'user-1'
    );
    expect(updated.name).toBe('Audio shelf');
    expect(updated.notes).toBeNull();

    await expect(service.getBox('BX-001')).rejects.toThrow('Box not found');

    const deleted = await service.deleteBox(String(created.id), 'user-1');
    expect(deleted).toEqual({
      deleted: true,
      id: created.id
    });
  });

  it('rejects duplicate boxCode values deterministically', async () => {
    const harness = createBoxesHarness();
    const auditService = { record: jest.fn(async () => undefined) };
    const service = new BoxesService(harness.prisma as never, auditService as never);

    await service.createBox(
      {
        boxCode: 'BX-100',
        name: 'Lighting'
      },
      'user-1'
    );

    await expect(
      service.createBox(
        {
          boxCode: 'bx-100',
          name: 'Lighting Duplicate'
        },
        'user-1'
      )
    ).rejects.toThrow('Duplicate box code');
  });

  describe('boxes API permissions and conflict boundaries', () => {
    let app: INestApplication;
    const previousNodeEnv = process.env.NODE_ENV;

    beforeAll(() => {
      process.env.NODE_ENV = 'test';
    });

    afterAll(() => {
      process.env.NODE_ENV = previousNodeEnv;
    });

    beforeEach(async () => {
      const harness = createBoxesHarness();
      const auditService = { record: jest.fn(async () => undefined) };

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
            useValue: auditService
          },
        {
          provide: AuthService,
          useValue: {
            getAuthenticatedUserFromToken: jest.fn()
          }
        },
        {
          provide: APP_CONFIG,
          useValue: {
            publicBaseUrl: 'https://app.example.test'
          }
        }
      ]
    }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it('allows admin and warehouse staff to execute CRUD lifecycle', async () => {
      const created = await request(app.getHttpServer())
        .post('/boxes')
        .set({ 'x-test-role': 'ADMIN' })
        .send({
          boxCode: 'BX-500',
          name: 'Lighting'
        })
        .expect(201);

      const boxId = String(created.body.box.id);

      await request(app.getHttpServer())
        .get('/boxes')
        .set({ 'x-test-role': 'WAREHOUSE_STAFF' })
        .expect(200)
        .expect((response) => {
          expect(Array.isArray(response.body.boxes)).toBe(true);
          expect(response.body.boxes).toHaveLength(1);
        });

      await request(app.getHttpServer())
        .patch(`/boxes/${boxId}`)
        .set({ 'x-test-role': 'WAREHOUSE_STAFF' })
        .send({
          notes: 'Main stage'
        })
        .expect(200)
        .expect((response) => {
          expect(response.body.box.notes).toBe('Main stage');
        });

      await request(app.getHttpServer())
        .delete(`/boxes/${boxId}`)
        .set({ 'x-test-role': 'ADMIN' })
        .expect(200)
        .expect((response) => {
          expect(response.body).toEqual({
            deleted: true,
            id: boxId
          });
        });
    });

    it('forbids user without boxes:write', async () => {
      const created = await request(app.getHttpServer())
        .post('/boxes')
        .set({ 'x-test-role': 'ADMIN' })
        .send({
          boxCode: 'BX-700',
          name: 'Audio'
        })
        .expect(201);

      const boxId = String(created.body.box.id);

      await request(app.getHttpServer())
        .post('/boxes')
        .set({ 'x-test-role': 'OFFICE_STAFF' })
        .send({
          boxCode: 'BX-701',
          name: 'Should fail'
        })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/boxes/${boxId}`)
        .set({ 'x-test-role': 'OFFICE_STAFF' })
        .send({
          name: 'Should fail'
        })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/boxes/${boxId}`)
        .set({ 'x-test-role': 'GUEST' })
        .expect(403);
    });

    it('rejects duplicate boxCode', async () => {
      await request(app.getHttpServer())
        .post('/boxes')
        .set({ 'x-test-role': 'ADMIN' })
        .send({
          boxCode: 'BX-900',
          name: 'Primary'
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/boxes')
        .set({ 'x-test-role': 'WAREHOUSE_STAFF' })
        .send({
          boxCode: 'bx-900',
          name: 'Duplicate'
        })
        .expect(409)
        .expect((response) => {
          expect(response.body.message).toContain('Duplicate box code');
        });
    });
  });
});
