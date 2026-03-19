import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AccessModule } from '../../src/access/access.module';
import { AuthService, SessionAuthGuard } from '../../src/auth/auth.service';
import { AuditService } from '../../src/audit/audit.service';
import { PrismaService } from '../../src/database/prisma.service';
import { EventsController } from '../../src/events/events.controller';
import { EventsService } from '../../src/events/events.service';
import { createEventsHarness } from './fixtures/events-harness';

describe('Event box expansion', () => {
  let app: INestApplication;
  let eventsService: EventsService;
  let harness: ReturnType<typeof createEventsHarness>;
  const previousNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  beforeEach(async () => {
    harness = createEventsHarness();
    const auditService = { record: jest.fn(async () => undefined) };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AccessModule],
      controllers: [EventsController],
      providers: [
        SessionAuthGuard,
        EventsService,
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
    eventsService = app.get(EventsService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('expands assigned box items and preserves existing plannedQuantity', async () => {
    const event = await eventsService.createEvent(
      {
        name: 'Expo',
        eventDate: '2026-04-05T10:00:00.000Z',
        location: 'Hall A'
      },
      'admin-1'
    );

    await eventsService.addEventItem(
      String(event.id),
      {
        itemId: harness.items[0].id,
        plannedQuantity: 7
      },
      'admin-1'
    );

    await request(app.getHttpServer())
      .post(`/events/${event.id}/boxes/box-1/add`)
      .set({ 'x-test-role': 'ADMIN' })
      .expect(201);

    const detail = await eventsService.getEvent(String(event.id), {});
    const rows = detail.items as Array<Record<string, unknown>>;
    const existing = rows.find((row) => row.itemId === harness.items[0].id);
    const added = rows.find((row) => row.itemId === harness.items[1].id);

    expect(existing?.plannedQuantity).toBe(7);
    expect(added?.plannedQuantity).toBe(1);
  });

  it('returns conflict when adding the same box twice to an event', async () => {
    const event = await eventsService.createEvent(
      {
        name: 'Expo',
        eventDate: '2026-04-05T10:00:00.000Z',
        location: 'Hall A'
      },
      'admin-1'
    );

    await request(app.getHttpServer())
      .post(`/events/${event.id}/boxes/box-1/add`)
      .set({ 'x-test-role': 'ADMIN' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/events/${event.id}/boxes/box-1/add`)
      .set({ 'x-test-role': 'ADMIN' })
      .expect(409);
  });

  it('formats first box code +N deterministically', async () => {
    const event = await eventsService.createEvent(
      {
        name: 'Expo',
        eventDate: '2026-04-05T10:00:00.000Z',
        location: 'Hall A'
      },
      'admin-1'
    );

    await request(app.getHttpServer())
      .post(`/events/${event.id}/boxes/box-2/add`)
      .set({ 'x-test-role': 'ADMIN' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/events/${event.id}/boxes/box-1/add`)
      .set({ 'x-test-role': 'ADMIN' })
      .expect(201);

    const detail = await eventsService.getEvent(String(event.id), {});
    const rows = detail.items as Array<Record<string, unknown>>;
    const row = rows.find((entry) => entry.itemId === harness.items[0].id);

    expect(row?.boxCode).toBe('BX-001 +1');
  });

  it('adds only missing box items without overwriting existing event quantities', async () => {
    const event = await eventsService.createEvent(
      {
        name: 'Expo',
        eventDate: '2026-04-05T10:00:00.000Z',
        location: 'Hall A'
      },
      'admin-1'
    );

    await request(app.getHttpServer())
      .post(`/events/${event.id}/boxes/box-1/add`)
      .set({ 'x-test-role': 'ADMIN' })
      .expect(201);

    ((harness as unknown as { boxItems?: Array<Record<string, unknown>> }).boxItems ?? []).push({
      boxId: 'box-1',
      itemId: harness.items[2].id,
      createdAt: new Date()
    });

    const before = await eventsService.getEvent(String(event.id), {});
    const firstRow = (before.items as Array<Record<string, unknown>>).find(
      (entry) => entry.itemId === harness.items[0].id
    );

    await request(app.getHttpServer())
      .post(`/events/${event.id}/boxes/box-1/add-missing`)
      .set({ 'x-test-role': 'ADMIN' })
      .expect(201);

    const after = await eventsService.getEvent(String(event.id), {});
    const rows = after.items as Array<Record<string, unknown>>;
    const preserved = rows.find((entry) => entry.itemId === harness.items[0].id);
    const missingAdded = rows.find((entry) => entry.itemId === harness.items[2].id);

    expect(preserved?.plannedQuantity).toBe(firstRow?.plannedQuantity);
    expect(missingAdded?.plannedQuantity).toBe(1);
  });

  it('removes a box from event linkage without reversing already-created lines', async () => {
    const event = await eventsService.createEvent(
      {
        name: 'Expo',
        eventDate: '2026-04-05T10:00:00.000Z',
        location: 'Hall A'
      },
      'admin-1'
    );

    await request(app.getHttpServer())
      .post(`/events/${event.id}/boxes/box-1/add`)
      .set({ 'x-test-role': 'ADMIN' })
      .expect(201);

    const before = await eventsService.getEvent(String(event.id), {});
    const beforeRows = before.items as Array<Record<string, unknown>>;

    await request(app.getHttpServer())
      .delete(`/events/${event.id}/boxes/box-1`)
      .set({ 'x-test-role': 'ADMIN' })
      .expect(200);

    const after = await eventsService.getEvent(String(event.id), {});
    const afterRows = after.items as Array<Record<string, unknown>>;

    expect(afterRows).toHaveLength(beforeRows.length);
  });

  it('does not auto-expand when adding a single item', async () => {
    const event = await eventsService.createEvent(
      {
        name: 'Expo',
        eventDate: '2026-04-05T10:00:00.000Z',
        location: 'Hall A'
      },
      'admin-1'
    );

    await request(app.getHttpServer())
      .post(`/events/${event.id}/items`)
      .set({ 'x-test-role': 'ADMIN' })
      .send({
        itemId: harness.items[0].id,
        plannedQuantity: 3
      })
      .expect(201);

    const detail = await eventsService.getEvent(String(event.id), {});
    const rows = detail.items as Array<Record<string, unknown>>;

    expect(rows).toHaveLength(1);
    expect(rows[0].itemId).toBe(harness.items[0].id);
  });
});
