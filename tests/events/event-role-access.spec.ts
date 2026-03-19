import type { INestApplication } from '@nestjs/common';
import { ForbiddenException, Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AccessModule } from '../../src/access/access.module';
import { AuthService, SessionAuthGuard } from '../../src/auth/auth.service';
import { EventsController } from '../../src/events/events.controller';
import { EventExportsService } from '../../src/events/event-exports.service';
import { EventsService } from '../../src/events/events.service';

const eventsServiceMock = {
  listEvents: jest.fn(async () => []),
  getEvent: jest.fn(async () => ({
    event: { id: 'evt-1', name: 'Expo', lifecycleStatus: 'DRAFT' },
    items: [],
    statusCounts: { TO_PACK: 0, PACKED: 0, RETURNED: 0, LOSS: 0 }
  })),
  createEvent: jest.fn(async () => ({ id: 'evt-1', name: 'Expo', lifecycleStatus: 'DRAFT' })),
  updateEvent: jest.fn(async () => ({ id: 'evt-1', name: 'Expo', lifecycleStatus: 'DRAFT' })),
  activateEvent: jest.fn(async () => ({ id: 'evt-1', lifecycleStatus: 'ACTIVE' })),
  closeEvent: jest.fn(async () => ({ id: 'evt-1', lifecycleStatus: 'CLOSED' })),
  reopenEvent: jest.fn(async (_eventId: string, _actorUserId: string | null, actorRole: string | null) => {
    if (actorRole !== 'ADMIN') {
      throw new ForbiddenException('Only Admin can reopen closed events');
    }
    return { id: 'evt-1', lifecycleStatus: 'ACTIVE' };
  }),
  addEventItem: jest.fn(async () => ({ id: 'evt-item-1', plannedQuantity: 2 })),
  removeEventItem: jest.fn(async () => ({ deleted: true, id: 'evt-item-1', eventId: 'evt-1' })),
  updateItemStatus: jest.fn(async () => ({ id: 'evt-item-1', status: 'PACKED' })),
  bulkUpdateItemStatus: jest.fn(async () => [{ id: 'evt-item-1', status: 'PACKED' }])
};

@Module({
  imports: [AccessModule],
  controllers: [EventsController],
  providers: [
    SessionAuthGuard,
    {
      provide: EventExportsService,
      useValue: {
        buildPackingListExport: jest.fn(async () => ({ filename: 'mock.xlsx', buffer: Buffer.alloc(0) })),
        buildPostEventReportExport: jest.fn(async () => ({
          filename: 'mock.xlsx',
          buffer: Buffer.alloc(0)
        }))
      }
    },
    {
      provide: EventsService,
      useValue: eventsServiceMock
    },
    {
      provide: AuthService,
      useValue: {
        getAuthenticatedUserFromToken: jest.fn()
      }
    }
  ]
})
class EventRoleAccessTestModule {}

describe('Event role access', () => {
  let app: INestApplication;
  const previousNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventRoleAccessTestModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows warehouse and office staff event writes', async () => {
    await request(app.getHttpServer())
      .post('/events')
      .set({ 'x-test-role': 'WAREHOUSE_STAFF' })
      .send({ name: 'Expo', eventDate: '2026-04-02T10:00:00.000Z', location: 'Hall A' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/events/evt-1/items')
      .set({ 'x-test-role': 'OFFICE_STAFF' })
      .send({ itemId: 'itm-1', plannedQuantity: 2 })
      .expect(201);

    await request(app.getHttpServer())
      .patch('/events/evt-1/items/status/bulk')
      .set({ 'x-test-role': 'OFFICE_STAFF' })
      .send({ eventItemIds: ['evt-item-1'], status: 'PACKED' })
      .expect(200);
  });

  it('allows guest reads and denies guest writes', async () => {
    await request(app.getHttpServer()).get('/events').set({ 'x-test-role': 'GUEST' }).expect(200);

    await request(app.getHttpServer())
      .get('/events/evt-1')
      .set({ 'x-test-role': 'GUEST' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/events')
      .set({ 'x-test-role': 'GUEST' })
      .send({ name: 'Expo', eventDate: '2026-04-02T10:00:00.000Z', location: 'Hall A' })
      .expect(403);
  });

  it('enforces Only Admin can reopen closed events', async () => {
    await request(app.getHttpServer())
      .post('/events/evt-1/reopen')
      .set({ 'x-test-role': 'OFFICE_STAFF' })
      .expect(403)
      .expect((response) => {
        expect(response.body.message).toContain('Only Admin can reopen closed events');
      });

    await request(app.getHttpServer())
      .post('/events/evt-1/reopen')
      .set({ 'x-test-role': 'ADMIN' })
      .expect(201);
  });
});
