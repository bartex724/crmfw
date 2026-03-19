import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import ExcelJS from 'exceljs';
import request = require('supertest');
import { AccessModule } from '../../src/access/access.module';
import { AuthService, SessionAuthGuard } from '../../src/auth/auth.service';
import { AuditService } from '../../src/audit/audit.service';
import { PrismaService } from '../../src/database/prisma.service';
import { EventsController } from '../../src/events/events.controller';
import { EventsService } from '../../src/events/events.service';
import { createEventsHarness } from './fixtures/events-harness';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const FILENAME_CONTRACT = 'event-{eventSlug}-{type}-{YYYYMMDD-HHmm}.xlsx';

type RoleHeader = 'ADMIN' | 'WAREHOUSE_STAFF' | 'OFFICE_STAFF' | 'GUEST';
type ExportType = 'packing-list' | 'post-event-report';
type CellScalar = string | number;

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

function readStringId(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Expected ${label} to be string`);
  }
  return value;
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

function readHeaders(worksheet: ExcelJS.Worksheet, columns: number): CellScalar[] {
  const headerRow = worksheet.getRow(1);
  return Array.from({ length: columns }, (_, index) =>
    normalizeCell(headerRow.getCell(index + 1).value)
  );
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

async function downloadWorkbook(
  app: INestApplication,
  eventId: string,
  type: ExportType,
  role: RoleHeader
): Promise<{ response: request.Response; workbook: ExcelJS.Workbook }> {
  const response = await request(app.getHttpServer())
    .get(`/events/${eventId}/exports/${type}`)
    .set({ 'x-test-role': role })
    .buffer(true)
    .parse(parseBinaryResponse)
    .expect(200)
    .expect('Content-Type', new RegExp(XLSX_MIME.replace('.', '\\.')));

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(response.body as Buffer);

  return { response, workbook };
}

function setExportBoxCode(
  harness: ReturnType<typeof createEventsHarness>,
  eventItemId: string,
  boxCode: string | null
): void {
  const row = harness.eventItems.find((entry) => entry.id === eventItemId);
  if (!row) {
    throw new Error(`Missing event item ${eventItemId}`);
  }
  row.boxCode = boxCode;
}

async function createExportFixture(
  eventsService: EventsService,
  harness: ReturnType<typeof createEventsHarness>,
  eventName = 'Summer Expo'
): Promise<{
  eventId: string;
  rowIds: {
    speaker: string;
    cableClassic: string;
    lamp: string;
    cableLite: string;
  };
}> {
  const event = (await eventsService.createEvent(
    {
      name: eventName,
      eventDate: '2026-06-15T10:00:00.000Z',
      location: 'Hall A'
    },
    'admin-1'
  )) as Record<string, unknown>;
  const eventId = readStringId(event.id, 'event.id');

  const speaker = (await eventsService.addEventItem(
    eventId,
    {
      itemId: harness.items[1].id,
      plannedQuantity: 4
    },
    'admin-1'
  )) as Record<string, unknown>;
  const cableClassic = (await eventsService.addEventItem(
    eventId,
    {
      itemId: harness.items[0].id,
      plannedQuantity: 3
    },
    'admin-1'
  )) as Record<string, unknown>;
  const lamp = (await eventsService.addEventItem(
    eventId,
    {
      itemId: harness.items[2].id,
      plannedQuantity: 2
    },
    'admin-1'
  )) as Record<string, unknown>;
  const cableLite = (await eventsService.addEventItem(
    eventId,
    {
      itemId: harness.items[3].id,
      plannedQuantity: 1
    },
    'admin-1'
  )) as Record<string, unknown>;

  const rowIds = {
    speaker: readStringId(speaker.id, 'speaker.id'),
    cableClassic: readStringId(cableClassic.id, 'cableClassic.id'),
    lamp: readStringId(lamp.id, 'lamp.id'),
    cableLite: readStringId(cableLite.id, 'cableLite.id')
  };

  setExportBoxCode(harness, rowIds.speaker, 'BOX-200');
  setExportBoxCode(harness, rowIds.cableClassic, 'BOX-100');
  setExportBoxCode(harness, rowIds.lamp, null);
  setExportBoxCode(harness, rowIds.cableLite, 'BOX-050');

  return { eventId, rowIds };
}

describe('Event Excel exports', () => {
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
          useValue: {
            record: jest.fn(async () => undefined)
          }
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

  it('exports packing-list workbook with deterministic ordering and xlsx headers', async () => {
    const { eventId } = await createExportFixture(eventsService, harness);

    const { response, workbook } = await downloadWorkbook(app, eventId, 'packing-list', 'ADMIN');

    expect(FILENAME_CONTRACT).toBe('event-{eventSlug}-{type}-{YYYYMMDD-HHmm}.xlsx');
    expect(response.headers['content-disposition']).toMatch(
      /^attachment; filename="event-summer-expo-packing-list-\d{8}-\d{4}\.xlsx"$/
    );

    const worksheet = workbook.getWorksheet(1);
    expect(worksheet).toBeDefined();
    expect(readHeaders(worksheet!, 4)).toEqual(['Name', 'Quantity', 'Box', 'Notes']);
    expect(readDataRows(worksheet!, 4)).toEqual([
      ['Cable', 1, 'BOX-050', ''],
      ['Cable', 3, 'BOX-100', ''],
      ['Lamp', 2, '', ''],
      ['Speaker', 4, 'BOX-200', '']
    ]);
  });

  it('exports post-event-report workbook with Loss column and deterministic rows', async () => {
    const { eventId, rowIds } = await createExportFixture(eventsService, harness);
    await eventsService.updateItemReconciliation(
      eventId,
      rowIds.cableClassic,
      { lostQuantity: 1, returnedQuantity: 0 },
      'admin-1'
    );
    await eventsService.updateItemReconciliation(
      eventId,
      rowIds.speaker,
      { lostQuantity: 2, returnedQuantity: 0 },
      'admin-1'
    );

    const { response, workbook } = await downloadWorkbook(
      app,
      eventId,
      'post-event-report',
      'OFFICE_STAFF'
    );

    expect(response.headers['content-disposition']).toMatch(
      /^attachment; filename="event-summer-expo-post-event-report-\d{8}-\d{4}\.xlsx"$/
    );

    const worksheet = workbook.getWorksheet(1);
    expect(worksheet).toBeDefined();
    expect(readHeaders(worksheet!, 5)).toEqual(['Name', 'Quantity', 'Loss', 'Box', 'Notes']);
    expect(readDataRows(worksheet!, 5)).toEqual([
      ['Cable', 1, 0, 'BOX-050', ''],
      ['Cable', 3, 1, 'BOX-100', ''],
      ['Lamp', 2, 0, '', ''],
      ['Speaker', 4, 2, 'BOX-200', '']
    ]);
  });

  it('reflects live reconciliation values at export request time', async () => {
    const event = (await eventsService.createEvent(
      {
        name: 'Live Snapshot',
        eventDate: '2026-07-20T12:00:00.000Z',
        location: 'Hall B'
      },
      'admin-1'
    )) as Record<string, unknown>;
    const eventId = readStringId(event.id, 'event.id');
    const item = (await eventsService.addEventItem(
      eventId,
      {
        itemId: harness.items[0].id,
        plannedQuantity: 5
      },
      'admin-1'
    )) as Record<string, unknown>;
    const eventItemId = readStringId(item.id, 'item.id');
    setExportBoxCode(harness, eventItemId, 'BOX-001');

    await request(app.getHttpServer())
      .patch(`/events/${eventId}/items/${eventItemId}/reconciliation`)
      .set({ 'x-test-role': 'ADMIN' })
      .send({ lostQuantity: 1, returnedQuantity: 0 })
      .expect(200);

    const firstReport = await downloadWorkbook(app, eventId, 'post-event-report', 'ADMIN');
    const firstWorksheet = firstReport.workbook.getWorksheet(1);
    expect(readDataRows(firstWorksheet!, 5)[0]).toEqual(['Cable', 5, 1, 'BOX-001', '']);

    await request(app.getHttpServer())
      .patch(`/events/${eventId}/items/${eventItemId}/reconciliation`)
      .set({ 'x-test-role': 'ADMIN' })
      .send({ lostQuantity: 3, returnedQuantity: 2 })
      .expect(200);

    const secondReport = await downloadWorkbook(app, eventId, 'post-event-report', 'ADMIN');
    const secondWorksheet = secondReport.workbook.getWorksheet(1);
    expect(readDataRows(secondWorksheet!, 5)[0]).toEqual(['Cable', 5, 3, 'BOX-001', '']);
  });

  it('allows warehouse export access and keeps guest denied', async () => {
    const { eventId } = await createExportFixture(eventsService, harness, 'Access Expo');

    await request(app.getHttpServer())
      .get(`/events/${eventId}/exports/packing-list`)
      .set({ 'x-test-role': 'WAREHOUSE_STAFF' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/events/${eventId}/exports/packing-list`)
      .set({ 'x-test-role': 'GUEST' })
      .expect(403);
  });
});
