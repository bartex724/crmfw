import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { EventItemStatus, EventLifecycleStatus } from '@prisma/client';
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

type EventRecord = {
  id: string;
  name: string;
  eventDate: Date;
  location: string;
  notes: string | null;
  lifecycleStatus: EventLifecycleStatus;
};

type EventBoxRecord = {
  eventId: string;
  boxId: string;
  createdAt: Date;
};

type ItemRecord = {
  id: string;
  name: string;
  code: string;
  quantity: number;
};

type EventItemRecord = {
  id: string;
  eventId: string;
  itemId: string;
  plannedQuantity: number;
  status: EventItemStatus;
  createdAt: Date;
  updatedAt: Date;
};

type EventItemBoxRecord = {
  eventItemId: string;
  boxId: string;
  createdAt: Date;
};

function createBoxScanHarness() {
  const boxes: BoxRecord[] = [
    {
      id: 'box-1',
      boxCode: 'BOX-001',
      name: 'Audio',
      notes: null,
      createdAt: new Date('2026-03-19T00:00:00.000Z'),
      updatedAt: new Date('2026-03-19T00:00:00.000Z')
    },
    {
      id: 'box-2',
      boxCode: 'BOX-002',
      name: 'Lights',
      notes: null,
      createdAt: new Date('2026-03-19T00:00:00.000Z'),
      updatedAt: new Date('2026-03-19T00:00:00.000Z')
    },
    {
      id: 'box-3',
      boxCode: 'BOX-099',
      name: 'Backup',
      notes: null,
      createdAt: new Date('2026-03-19T00:00:00.000Z'),
      updatedAt: new Date('2026-03-19T00:00:00.000Z')
    }
  ];

  const events: EventRecord[] = [
    {
      id: 'event-1',
      name: 'Main Expo',
      eventDate: new Date('2026-06-20T10:00:00.000Z'),
      location: 'Hall A',
      notes: null,
      lifecycleStatus: EventLifecycleStatus.ACTIVE
    },
    {
      id: 'event-2',
      name: 'Old Show',
      eventDate: new Date('2026-02-20T10:00:00.000Z'),
      location: 'Hall B',
      notes: null,
      lifecycleStatus: EventLifecycleStatus.CLOSED
    }
  ];

  const eventBoxes: EventBoxRecord[] = [
    {
      eventId: 'event-1',
      boxId: 'box-1',
      createdAt: new Date('2026-06-01T08:00:00.000Z')
    },
    {
      eventId: 'event-2',
      boxId: 'box-2',
      createdAt: new Date('2026-02-01T08:00:00.000Z')
    }
  ];

  const items: ItemRecord[] = [
    { id: 'item-1', name: 'Speaker', code: 'ITM-001', quantity: 10 },
    { id: 'item-2', name: 'Cable', code: 'ITM-002', quantity: 25 },
    { id: 'item-3', name: 'Tripod', code: 'ITM-003', quantity: 4 }
  ];

  const eventItems: EventItemRecord[] = [
    {
      id: 'event-item-1',
      eventId: 'event-1',
      itemId: 'item-1',
      plannedQuantity: 2,
      status: EventItemStatus.TO_PACK,
      createdAt: new Date('2026-06-10T10:00:00.000Z'),
      updatedAt: new Date('2026-06-10T10:00:00.000Z')
    },
    {
      id: 'event-item-2',
      eventId: 'event-1',
      itemId: 'item-2',
      plannedQuantity: 1,
      status: EventItemStatus.PACKED,
      createdAt: new Date('2026-06-11T10:00:00.000Z'),
      updatedAt: new Date('2026-06-11T10:00:00.000Z')
    },
    {
      id: 'event-item-3',
      eventId: 'event-1',
      itemId: 'item-3',
      plannedQuantity: 1,
      status: EventItemStatus.TO_PACK,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
      updatedAt: new Date('2026-06-12T10:00:00.000Z')
    }
  ];

  const eventItemBoxes: EventItemBoxRecord[] = [
    {
      eventItemId: 'event-item-1',
      boxId: 'box-3',
      createdAt: new Date('2026-06-01T09:00:00.000Z')
    },
    {
      eventItemId: 'event-item-1',
      boxId: 'box-1',
      createdAt: new Date('2026-06-02T09:00:00.000Z')
    },
    {
      eventItemId: 'event-item-2',
      boxId: 'box-1',
      createdAt: new Date('2026-06-01T09:00:00.000Z')
    },
    {
      eventItemId: 'event-item-3',
      boxId: 'box-3',
      createdAt: new Date('2026-06-01T09:00:00.000Z')
    }
  ];

  const prisma = {
    box: {
      findFirst: jest.fn(async ({ where }: { where: { boxCode?: { equals: string } } }) => {
        const normalized = where.boxCode?.equals.toLowerCase() ?? '';
        const row = boxes.find((box) => box.boxCode.toLowerCase() === normalized);
        return row ? { ...row } : null;
      })
    },
    eventBox: {
      findMany: jest.fn(
        async ({
          where
        }: {
          where: { boxId: string; event?: { lifecycleStatus?: EventLifecycleStatus } };
        }) => {
          const lifecycleStatus = where.event?.lifecycleStatus;
          return eventBoxes
            .filter((link) => link.boxId === where.boxId)
            .map((link) => ({
              ...link,
              event: events.find((entry) => entry.id === link.eventId) ?? null
            }))
            .filter((link) => {
              if (!link.event) {
                return false;
              }
              if (!lifecycleStatus) {
                return true;
              }
              return link.event.lifecycleStatus === lifecycleStatus;
            });
        }
      )
    },
    eventItemBox: {
      findMany: jest.fn(
        async ({
          where
        }: {
          where: { boxId: string; eventItem?: { eventId?: string } };
        }) => {
          const targetEventId = where.eventItem?.eventId;
          return eventItemBoxes
            .filter((entry) => entry.boxId === where.boxId)
            .map((entry) => {
              const eventItem = eventItems.find((item) => item.id === entry.eventItemId);
              if (!eventItem) {
                return null;
              }

              if (targetEventId && eventItem.eventId !== targetEventId) {
                return null;
              }

              return {
                ...entry,
                eventItem: {
                  ...eventItem,
                  item: items.find((item) => item.id === eventItem.itemId) ?? null,
                  eventItemBoxes: eventItemBoxes
                    .filter((link) => link.eventItemId === eventItem.id)
                    .map((link) => ({
                      ...link,
                      box: boxes.find((box) => box.id === link.boxId) ?? { boxCode: 'UNKNOWN' }
                    }))
                }
              };
            })
            .filter((entry) => entry !== null);
        }
      )
    }
  };

  return { prisma };
}

describe('Box scan flow', () => {
  let app: INestApplication;
  const previousNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  beforeEach(async () => {
    const harness = createBoxScanHarness();
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

  it('requires boxes:read permission', async () => {
    await request(app.getHttpServer()).get('/boxes/BOX-001/scan').expect(401);

    await request(app.getHttpServer())
      .get('/boxes/BOX-001/scan')
      .set({ 'x-test-role': 'GUEST' })
      .expect(200);
  });

  it('returns openUrl using /boxes/:boxId', async () => {
    await request(app.getHttpServer())
      .get('/boxes/BOX-001/scan')
      .set({ 'x-test-role': 'GUEST' })
      .expect(200)
      .expect((response) => {
        expect(response.body.scan.openUrl).toBe('/boxes/box-1');
        expect(response.body.scan.hasActiveEvent).toBe(true);
        expect(response.body.scan.warningCode).toBeNull();
      });
  });

  it('returns warning state when no active event is linked', async () => {
    await request(app.getHttpServer())
      .get('/boxes/BOX-002/scan')
      .set({ 'x-test-role': 'GUEST' })
      .expect(200)
      .expect((response) => {
        expect(response.body.scan.hasActiveEvent).toBe(false);
        expect(response.body.scan.warningCode).toBe('BOX_NOT_IN_ACTIVE_EVENT');
        expect(response.body.scan.quickAction.endpointTemplate).toBe(
          '/events/:eventId/boxes/box-2/add'
        );
      });
  });

  it('requires explicit event selection', async () => {
    await request(app.getHttpServer())
      .get('/boxes/BOX-001/context')
      .set({ 'x-test-role': 'GUEST' })
      .expect(200)
      .expect((response) => {
        expect(response.body.context.requiresEventSelection).toBe(true);
        expect(response.body.context.selectedEventId).toBeNull();
        expect(response.body.context.items).toEqual([]);
        expect(response.body.context.activeEvents).toHaveLength(1);
      });
  });

  it('returns only selected-box rows for selected event context', async () => {
    await request(app.getHttpServer())
      .get('/boxes/BOX-001/context')
      .query({ eventId: 'event-1' })
      .set({ 'x-test-role': 'GUEST' })
      .expect(200)
      .expect((response) => {
        expect(response.body.context.selectedEventId).toBe('event-1');
        expect(response.body.context.items).toHaveLength(2);
        const itemIds = response.body.context.items.map((row: { itemId: string }) => row.itemId);
        expect(itemIds.sort()).toEqual(['item-1', 'item-2']);
        expect(response.body.context.actions.updateItemStatus).toBe(
          '/events/event-1/items/:eventItemId/status'
        );
      });
  });

  it('formats first box code +N deterministically', async () => {
    await request(app.getHttpServer())
      .get('/boxes/BOX-001/context')
      .query({ eventId: 'event-1' })
      .set({ 'x-test-role': 'GUEST' })
      .expect(200)
      .expect((response) => {
        const first = response.body.context.items.find(
          (row: { itemId: string }) => row.itemId === 'item-1'
        );
        const second = response.body.context.items.find(
          (row: { itemId: string }) => row.itemId === 'item-2'
        );
        expect(first.boxCode).toBe('BOX-099 +1');
        expect(second.boxCode).toBe('BOX-001');
      });
  });
});
