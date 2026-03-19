import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventLifecycleStatus, type Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../database/prisma.service';

const XLSX_SHEET_NAME_PACKING_LIST = 'Packing List';
const XLSX_SHEET_NAME_POST_EVENT_REPORT = 'Post-event Report';

type EventExportType = 'packing-list' | 'post-event-report';
type WorkbookResult = {
  filename: string;
  buffer: Buffer;
};

type ExportSourceEvent = Prisma.EventGetPayload<{
  include: {
    items: {
      include: {
        item: {
          select: {
            name: true;
            code: true;
          };
        };
      };
    };
  };
}>;

type ExportRow = {
  itemName: string;
  itemCode: string;
  plannedQuantity: number;
  lostQuantity: number;
  boxCode: string;
  notes: string;
};

@Injectable()
export class EventExportsService {
  constructor(private readonly prisma: PrismaService) {}

  async buildPackingListExport(eventId: string): Promise<WorkbookResult> {
    const event = await this.loadExportEvent(eventId);
    const rows = this.mapExportRows(event);
    const buffer = await this.buildWorkbook(XLSX_SHEET_NAME_PACKING_LIST, [
      { header: 'Name', key: 'name', width: 36 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'Box', key: 'box', width: 18 },
      { header: 'Notes', key: 'notes', width: 32 }
    ], rows.map((row) => ({
      name: row.itemName,
      quantity: row.plannedQuantity,
      box: row.boxCode,
      notes: row.notes
    })));

    return {
      filename: this.buildFilename(event.name, 'packing-list'),
      buffer
    };
  }

  async buildPostEventReportExport(eventId: string): Promise<WorkbookResult> {
    const event = await this.loadExportEvent(eventId);
    const rows = this.mapExportRows(event);
    const buffer = await this.buildWorkbook(XLSX_SHEET_NAME_POST_EVENT_REPORT, [
      { header: 'Name', key: 'name', width: 36 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'Loss', key: 'loss', width: 12 },
      { header: 'Box', key: 'box', width: 18 },
      { header: 'Notes', key: 'notes', width: 32 }
    ], rows.map((row) => ({
      name: row.itemName,
      quantity: row.plannedQuantity,
      loss: row.lostQuantity,
      box: row.boxCode,
      notes: row.notes
    })));

    return {
      filename: this.buildFilename(event.name, 'post-event-report'),
      buffer
    };
  }

  private async loadExportEvent(eventId: string): Promise<ExportSourceEvent> {
    const event = await this.prisma.event.findUnique({
      where: {
        id: eventId
      },
      include: {
        items: {
          include: {
            item: {
              select: {
                name: true,
                code: true
              }
            }
          }
        }
      }
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const allowedLifecycleStates: EventLifecycleStatus[] = [
      EventLifecycleStatus.DRAFT,
      EventLifecycleStatus.ACTIVE,
      EventLifecycleStatus.CLOSED
    ];
    if (!allowedLifecycleStates.includes(event.lifecycleStatus)) {
      throw new BadRequestException('Event lifecycle does not allow exports');
    }

    return event;
  }

  private mapExportRows(event: ExportSourceEvent): ExportRow[] {
    return event.items
      .map((row) => ({
        itemName: row.item.name,
        itemCode: row.item.code,
        plannedQuantity: row.plannedQuantity,
        lostQuantity: row.lostQuantity ?? 0,
        boxCode: row.boxCode ?? '',
        notes: ''
      }))
      .sort(
        (left, right) =>
          left.itemName.localeCompare(right.itemName) || left.itemCode.localeCompare(right.itemCode)
      );
  }

  private buildFilename(eventName: string, type: EventExportType): string {
    const eventSlug = this.toSlug(eventName);
    const timestamp = this.formatUtcTimestamp(new Date());
    return `event-${eventSlug}-${type}-${timestamp}.xlsx`;
  }

  private toSlug(value: string): string {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug.length > 0 ? slug : 'event';
  }

  private formatUtcTimestamp(date: Date): string {
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${year}${month}${day}-${hours}${minutes}`;
  }

  private async buildWorkbook(
    worksheetName: string,
    columns: Array<{ header: string; key: string; width: number }>,
    rows: Array<Record<string, string | number>>
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(worksheetName);
    worksheet.columns = columns;
    worksheet.addRows(rows);

    const payload = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  }
}
