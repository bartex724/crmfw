import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AccessModule } from '../../src/access/access.module';
import { AuthService, SessionAuthGuard } from '../../src/auth/auth.service';
import { AuditService } from '../../src/audit/audit.service';
import { BoxesController } from '../../src/boxes/boxes.controller';
import { BoxesService } from '../../src/boxes/boxes.service';
import { PrismaService } from '../../src/database/prisma.service';

type BoxRecord = {
  id: string;
  boxCode: string;
  name: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ItemRecord = {
  id: string;
  name: string;
  code: string;
  quantity: number;
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
};

type BoxItemRecord = {
  boxId: string;
  itemId: string;
  createdAt: Date;
};

function createBoxItemHarness() {
  const now = new Date();
  const boxes: BoxRecord[] = [
    {
      id: 'box-1',
      boxCode: 'BX-001',
      name: 'Audio',
      notes: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'box-2',
      boxCode: 'BX-002',
      name: 'Lights',
      notes: null,
      createdAt: now,
      updatedAt: now
    }
  ];

  const items: ItemRecord[] = [
    {
      id: 'item-1',
      name: 'Speaker',
      code: 'ITM-0001',
      quantity: 10,
      categoryId: 'cat-1',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'item-2',
      name: 'Cable',
      code: 'ITM-0002',
      quantity: 15,
      categoryId: 'cat-1',
      createdAt: now,
      updatedAt: now
    }
  ];

  const boxItems: BoxItemRecord[] = [];

  const prisma = {
    box: {
      findMany: jest.fn(async () => boxes.map((box) => ({ ...box }))),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const match = boxes.find((box) => box.id === where.id);
        return match ? { ...match } : null;
      }),
      findFirst: jest.fn(async () => null),
      create: jest.fn(async () => {
        throw new Error('not implemented in this harness');
      }),
      update: jest.fn(async () => {
        throw new Error('not implemented in this harness');
      }),
      delete: jest.fn(async () => {
        throw new Error('not implemented in this harness');
      })
    },
    item: {
      findMany: jest.fn(
        async ({
          where
        }: {
          where: {
            id: {
              in: string[];
            };
          };
        }) => items.filter((item) => where.id.in.includes(item.id)).map((item) => ({ ...item }))
      )
    },
    boxItem: {
      deleteMany: jest.fn(async ({ where }: { where: { boxId: string } }) => {
        const before = boxItems.length;
        for (let index = boxItems.length - 1; index >= 0; index -= 1) {
          if (boxItems[index].boxId === where.boxId) {
            boxItems.splice(index, 1);
          }
        }
        return { count: before - boxItems.length };
      }),
      createMany: jest.fn(
        async ({
          data
        }: {
          data: Array<{
            boxId: string;
            itemId: string;
          }>;
        }) => {
          for (const row of data) {
            const duplicate = boxItems.find(
              (entry) => entry.boxId === row.boxId && entry.itemId === row.itemId
            );
            if (!duplicate) {
              boxItems.push({
                boxId: row.boxId,
                itemId: row.itemId,
                createdAt: new Date()
              });
            }
          }
          return { count: data.length };
        }
      )
    }
  };

  const prismaWithTransaction = {
    ...prisma,
    $transaction: async <T>(fn: (tx: typeof prisma) => Promise<T>): Promise<T> => fn(prisma)
  };

  return {
    prisma: prismaWithTransaction,
    boxItems
  };
}

describe('Box item assignment', () => {
  let app: INestApplication;
  let harness: ReturnType<typeof createBoxItemHarness>;
  const previousNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  beforeEach(async () => {
    harness = createBoxItemHarness();
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
        }
      ]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects duplicate itemIds', async () => {
    await request(app.getHttpServer())
      .put('/boxes/box-1/items')
      .set({ 'x-test-role': 'ADMIN' })
      .send({
        itemIds: ['item-1', 'item-1']
      })
      .expect(400);
  });

  it('rejects unknown inventory item ids', async () => {
    await request(app.getHttpServer())
      .put('/boxes/box-1/items')
      .set({ 'x-test-role': 'ADMIN' })
      .send({
        itemIds: ['item-1', 'missing-item']
      })
      .expect(400);
  });

  it('replaces membership idempotently for the same box', async () => {
    await request(app.getHttpServer())
      .put('/boxes/box-1/items')
      .set({ 'x-test-role': 'WAREHOUSE_STAFF' })
      .send({
        itemIds: ['item-1', 'item-2']
      })
      .expect(200);

    expect(
      harness.boxItems
        .filter((row) => row.boxId === 'box-1')
        .map((row) => row.itemId)
        .sort()
    ).toEqual(['item-1', 'item-2']);

    await request(app.getHttpServer())
      .put('/boxes/box-1/items')
      .set({ 'x-test-role': 'WAREHOUSE_STAFF' })
      .send({
        itemIds: ['item-1', 'item-2']
      })
      .expect(200);

    expect(
      harness.boxItems
        .filter((row) => row.boxId === 'box-1')
        .map((row) => row.itemId)
        .sort()
    ).toEqual(['item-1', 'item-2']);

    await request(app.getHttpServer())
      .put('/boxes/box-1/items')
      .set({ 'x-test-role': 'WAREHOUSE_STAFF' })
      .send({
        itemIds: ['item-2']
      })
      .expect(200);

    expect(
      harness.boxItems
        .filter((row) => row.boxId === 'box-1')
        .map((row) => row.itemId)
    ).toEqual(['item-2']);
  });

  it('allows assigning one item to multiple boxes', async () => {
    await request(app.getHttpServer())
      .put('/boxes/box-1/items')
      .set({ 'x-test-role': 'ADMIN' })
      .send({
        itemIds: ['item-1']
      })
      .expect(200);

    await request(app.getHttpServer())
      .put('/boxes/box-2/items')
      .set({ 'x-test-role': 'ADMIN' })
      .send({
        itemIds: ['item-1']
      })
      .expect(200);

    expect(
      harness.boxItems
        .filter((row) => row.itemId === 'item-1')
        .map((row) => row.boxId)
        .sort()
    ).toEqual(['box-1', 'box-2']);
  });
});
