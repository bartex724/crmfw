import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import * as ExcelJS from 'exceljs';
import request = require('supertest');
import { AccessModule } from '../../src/access/access.module';
import { AuthService, SessionAuthGuard } from '../../src/auth/auth.service';
import { AuditService } from '../../src/audit/audit.service';
import { PrismaService } from '../../src/database/prisma.service';
import { EventsController } from '../../src/events/events.controller';
import { EventExportsService } from '../../src/events/event-exports.service';
import { EventsService } from '../../src/events/events.service';
import { createEventsHarness } from './fixtures/events-harness';

type CellScalar = string | number;
type ReconciliationAuditCall = {
  metadata?: {
    previousLostQuantity?: number;
    nextLostQuantity?: number;
    previousReturnedQuantity?: number;
    nextReturnedQuantity?: number;
    stockDelta?: number;
    beforeItemQuantity?: number;
    afterItemQuantity?: number;
  };
};

function parseBinaryResponse(
  response: NodeJS.ReadableStream,
  callback: (error: Error | null, body: Buffer) => void
): void {
  const chunks: Buffer[] = [];
  let completed = false;

  const done = (error: Error | null, body: Buffer): void => {
    if (completed) {
      return;
    }
    completed = true;
    callback(error, body);
  };

  response.on('data', (chunk: Buffer | string) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'binary'));
  });
  response.on('error', (error: Error) => done(error, Buffer.alloc(0)));
  response.on('end', () => done(null, Buffer.concat(chunks)));
}

function normalizeCell(value: ExcelJS.CellValue): CellScalar {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  if (value == null) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') {
    return value.text;
  }
  if (typeof value === 'object' && 'result' in value) {
    return normalizeCell((value.result as ExcelJS.CellValue) ?? '');
  }
  return String(value);
}

function readDataRows(worksheet: ExcelJS.Worksheet, columns: number): CellScalar[][] {
  const rows: CellScalar[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    rows.push(
      Array.from({ length: columns }, (_, index) => normalizeCell(row.getCell(index + 1).value))
    );
  });
  return rows;
}

function readStringId(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Expected ${label} to be string`);
  }
  return value;
}

describe('Reconciliation to export regression', () => {
  let app: INestApplication;
  let eventsService: EventsService;
  let harness: ReturnType<typeof createEventsHarness>;
  let auditService: { record: jest.Mock<Promise<void>, [Record<string, unknown>]> };
  const previousNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  beforeEach(async () => {
    harness = createEventsHarness();
    auditService = { record: jest.fn(async () => undefined) };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AccessModule],
      controllers: [EventsController],
      providers: [
        SessionAuthGuard,
        EventsService,
        EventExportsService,
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

  it('uses latest reconciliation values in post-event export', async () => {
    const event = (await eventsService.createEvent(
      {
        name: 'Regression Expo',
        eventDate: '2026-08-01T10:00:00.000Z',
        location: 'Hall A'
      },
      'admin-1'
    )) as Record<string, unknown>;
    const eventId = readStringId(event.id, 'event.id');

    const row = (await eventsService.addEventItem(
      eventId,
      {
        itemId: harness.items[0].id,
        plannedQuantity: 6
      },
      'admin-1'
    )) as Record<string, unknown>;
    const rowId = readStringId(row.id, 'row.id');

    await eventsService.updateItemReconciliation(
      eventId,
      rowId,
      { lostQuantity: 1, returnedQuantity: 0 },
      'admin-1'
    );
    await eventsService.updateItemReconciliation(
      eventId,
      rowId,
      { lostQuantity: 4, returnedQuantity: 1 },
      'admin-1'
    );
    await eventsService.updateItemReconciliation(
      eventId,
      rowId,
      { lostQuantity: 2, returnedQuantity: 2 },
      'admin-1'
    );

    expect(harness.items[0].quantity).toBe(8);
    expect(harness.stockAdjustments.map((adjustment) => adjustment.delta)).toEqual([-1, -3, 2]);

    await eventsService.activateEvent(eventId, 'admin-1');
    await eventsService.closeEvent(eventId, 'admin-1');

    const response = await request(app.getHttpServer())
      .get(`/events/${eventId}/exports/post-event-report`)
      .set({ 'x-test-role': 'OFFICE_STAFF' })
      .buffer(true)
      .parse(parseBinaryResponse)
      .expect(200);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(response.body as Buffer);
    const worksheet = workbook.getWorksheet(1);
    expect(worksheet).toBeDefined();
    expect(readDataRows(worksheet!, 5)).toEqual([['Cable', 6, 2, '', '']]);
  });

  it('records reconciliation audit metadata', async () => {
    const event = (await eventsService.createEvent(
      {
        name: 'Audit Regression',
        eventDate: '2026-08-02T10:00:00.000Z',
        location: 'Hall B'
      },
      'admin-1'
    )) as Record<string, unknown>;
    const eventId = readStringId(event.id, 'event.id');

    const row = (await eventsService.addEventItem(
      eventId,
      {
        itemId: harness.items[0].id,
        plannedQuantity: 6
      },
      'admin-1'
    )) as Record<string, unknown>;
    const rowId = readStringId(row.id, 'row.id');

    await eventsService.updateItemReconciliation(
      eventId,
      rowId,
      { lostQuantity: 1, returnedQuantity: 1 },
      'admin-1'
    );
    await eventsService.updateItemReconciliation(
      eventId,
      rowId,
      { lostQuantity: 3, returnedQuantity: 2 },
      'admin-1'
    );

    const reconciliationAuditCalls = auditService.record.mock.calls
      .map(([payload]) => payload as ReconciliationAuditCall & { action?: string })
      .filter((payload) => payload.action === 'event.item.reconciliation.updated');

    expect(reconciliationAuditCalls).toHaveLength(2);
    expect(reconciliationAuditCalls[0].metadata).toEqual(
      expect.objectContaining({
        previousLostQuantity: 0,
        nextLostQuantity: 1,
        previousReturnedQuantity: 0,
        nextReturnedQuantity: 1,
        stockDelta: -1,
        beforeItemQuantity: 10,
        afterItemQuantity: 9
      })
    );
    expect(reconciliationAuditCalls[1].metadata).toEqual(
      expect.objectContaining({
        previousLostQuantity: 1,
        nextLostQuantity: 3,
        previousReturnedQuantity: 1,
        nextReturnedQuantity: 2,
        stockDelta: -2,
        beforeItemQuantity: 9,
        afterItemQuantity: 7
      })
    );
  });
});
