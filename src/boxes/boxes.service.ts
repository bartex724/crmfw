import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { EventLifecycleStatus, type Prisma } from '@prisma/client';
import * as QRCode from 'qrcode';
import { AuditService } from '../audit/audit.service';
import { APP_CONFIG } from '../config/config.module';
import { type AppConfig, buildConfiguration } from '../config/configuration';
import { PrismaService } from '../database/prisma.service';
import { AssignBoxItemsDto } from './dto/assign-box-items.dto';
import { CreateBoxDto } from './dto/create-box.dto';
import { type BoxSortField, type BoxSortOrder, ListBoxesQueryDto } from './dto/list-boxes-query.dto';
import { UpdateBoxDto } from './dto/update-box.dto';

type BoxWithTimestamps = {
  id: string;
  boxCode: string;
  name: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class BoxesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(APP_CONFIG) private readonly config?: AppConfig
  ) {}

  async listBoxes(query: ListBoxesQueryDto = {}): Promise<Array<Record<string, unknown>>> {
    const where: Prisma.BoxWhereInput = {};

    const normalizedSearch = query.search?.trim();
    if (normalizedSearch) {
      where.OR = [
        {
          boxCode: {
            contains: normalizedSearch,
            mode: 'insensitive'
          }
        },
        {
          name: {
            contains: normalizedSearch,
            mode: 'insensitive'
          }
        }
      ];
    }

    const sortBy = query.sortBy ?? 'boxCode';
    const sortOrder = query.sortOrder ?? 'asc';
    const page = this.parsePositiveInteger((query as Record<string, unknown>).page, 'page', 1);
    const pageSize = this.parsePositiveInteger(
      (query as Record<string, unknown>).pageSize,
      'pageSize',
      25
    );

    const boxes = await this.prisma.box.findMany({
      where,
      orderBy: this.resolveSort(sortBy, sortOrder),
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    return boxes.map((box) => this.toBoxResponse(box as BoxWithTimestamps));
  }

  async getBox(boxId: string): Promise<Record<string, unknown>> {
    const box = await this.prisma.box.findUnique({
      where: {
        id: boxId
      }
    });

    if (!box) {
      throw new NotFoundException('Box not found');
    }

    return this.toBoxResponse(box as BoxWithTimestamps);
  }

  async getBoxQr(boxCode: string): Promise<{
    boxId: string;
    boxCode: string;
    payloadUrl: string;
    qrDataUrl: string;
  }> {
    const normalizedCode = this.normalizeCode(boxCode);
    const box = await this.prisma.box.findFirst({
      where: {
        boxCode: {
          equals: normalizedCode,
          mode: 'insensitive'
        }
      }
    });

    if (!box) {
      throw new NotFoundException('Box not found');
    }

    const publicBaseUrl = this.config?.publicBaseUrl ?? buildConfiguration(process.env).publicBaseUrl;
    const payloadUrl = `${publicBaseUrl}/boxes/${box.boxCode}/scan`;
    const qrDataUrl = await QRCode.toDataURL(payloadUrl);

    return {
      boxId: box.id,
      boxCode: box.boxCode,
      payloadUrl,
      qrDataUrl
    };
  }

  async resolveScanEntry(boxCode: string): Promise<Record<string, unknown>> {
    const box = await this.findBoxByCode(boxCode);
    const activeLinks = (await this.prisma.eventBox.findMany({
      where: {
        boxId: box.id,
        event: {
          lifecycleStatus: EventLifecycleStatus.ACTIVE
        }
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            eventDate: true,
            location: true
          }
        }
      }
    })) as Array<{
      event: {
        id: string;
        name: string;
        eventDate: Date;
        location: string;
      };
    }>;

    const latestActiveEvent =
      activeLinks
        .map((entry) => entry.event)
        .sort((left, right) => right.eventDate.getTime() - left.eventDate.getTime())[0] ?? null;

    return {
      box: this.toBoxResponse(box),
      openUrl: `/boxes/${box.id}`,
      hasActiveEvent: latestActiveEvent !== null,
      activeEvent: latestActiveEvent,
      warningCode: latestActiveEvent ? null : 'BOX_NOT_IN_ACTIVE_EVENT',
      quickAction: latestActiveEvent
        ? null
        : {
            type: 'ADD_TO_EVENT',
            method: 'POST',
            endpointTemplate: `/events/:eventId/boxes/${box.id}/add`
          }
    };
  }

  async getBoxEventContext(boxCode: string, eventId?: string): Promise<Record<string, unknown>> {
    const box = await this.findBoxByCode(boxCode);
    const activeLinks = (await this.prisma.eventBox.findMany({
      where: {
        boxId: box.id,
        event: {
          lifecycleStatus: EventLifecycleStatus.ACTIVE
        }
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            eventDate: true,
            location: true,
            lifecycleStatus: true
          }
        }
      }
    })) as Array<{
      event: {
        id: string;
        name: string;
        eventDate: Date;
        location: string;
        lifecycleStatus: EventLifecycleStatus;
      };
    }>;

    const activeEvents = activeLinks
      .map((entry) => entry.event)
      .sort((left, right) => right.eventDate.getTime() - left.eventDate.getTime())
      .map((event) => ({
        id: event.id,
        name: event.name,
        eventDate: event.eventDate,
        location: event.location,
        lifecycleStatus: event.lifecycleStatus
      }));

    if (!eventId) {
      return {
        box: this.toBoxResponse(box),
        activeEvents,
        selectedEventId: null,
        requiresEventSelection: true,
        warningCode: activeEvents.length > 0 ? null : 'BOX_NOT_IN_ACTIVE_EVENT',
        quickAction:
          activeEvents.length > 0
            ? null
            : {
                type: 'ADD_TO_EVENT',
                method: 'POST',
                endpointTemplate: `/events/:eventId/boxes/${box.id}/add`
              },
        actions: null,
        items: []
      };
    }

    const selectedActiveEvent = activeEvents.find((event) => event.id === eventId);
    if (!selectedActiveEvent) {
      throw new BadRequestException('Selected event is not active for this box');
    }

    const linkedRows = (await this.prisma.eventItemBox.findMany({
      where: {
        boxId: box.id,
        eventItem: {
          eventId
        }
      },
      include: {
        eventItem: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                code: true,
                quantity: true
              }
            },
            eventItemBoxes: {
              include: {
                box: {
                  select: {
                    boxCode: true
                  }
                }
              }
            }
          }
        }
      }
    })) as Array<{
      eventItem: {
        id: string;
        eventId: string;
        itemId: string;
        plannedQuantity: number;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        item?: {
          id: string;
          name: string;
          code: string;
          quantity: number;
        } | null;
        eventItemBoxes: Array<{
          createdAt: Date;
          box: {
            boxCode: string;
          };
        }>;
      };
    }>;

    const items = linkedRows
      .map((entry) => entry.eventItem)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((eventItem) => {
        const boxMarker = this.formatBoxMarker(eventItem.eventItemBoxes);
        return {
          id: eventItem.id,
          eventId: eventItem.eventId,
          itemId: eventItem.itemId,
          itemName: eventItem.item?.name ?? null,
          itemCode: eventItem.item?.code ?? null,
          plannedQuantity: eventItem.plannedQuantity,
          status: eventItem.status,
          boxCode: boxMarker,
          boxLabel: boxMarker ?? 'No box',
          boxWarning: boxMarker ? null : 'NO_BOX_LINK',
          createdAt: eventItem.createdAt,
          updatedAt: eventItem.updatedAt
        };
      });

    return {
      box: this.toBoxResponse(box),
      activeEvents,
      selectedEventId: eventId,
      requiresEventSelection: true,
      warningCode: null,
      quickAction: null,
      actions: {
        updateItemStatus: `/events/${eventId}/items/:eventItemId/status`,
        bulkUpdateItemStatus: `/events/${eventId}/items/status/bulk`,
        addMissingItems: `/events/${eventId}/boxes/${box.id}/add-missing`
      },
      items
    };
  }

  async createBox(dto: CreateBoxDto, actorUserId: string | null): Promise<Record<string, unknown>> {
    const boxCode = this.normalizeCode(dto.boxCode);
    const name = this.normalizeRequiredText(dto.name, 'Box name is required');
    await this.ensureUniqueBoxCode(boxCode, null);

    const box = await this.prisma.box.create({
      data: {
        boxCode,
        name,
        notes: this.normalizeOptionalText(dto.notes)
      }
    });

    await this.auditService.record({
      action: 'box.created',
      entityType: 'box',
      entityId: box.id,
      actorUserId,
      metadata: {
        boxCode: box.boxCode,
        name: box.name
      }
    });

    return this.toBoxResponse(box as BoxWithTimestamps);
  }

  async updateBox(
    boxId: string,
    dto: UpdateBoxDto,
    actorUserId: string | null
  ): Promise<Record<string, unknown>> {
    const existing = await this.prisma.box.findUnique({
      where: {
        id: boxId
      }
    });

    if (!existing) {
      throw new NotFoundException('Box not found');
    }

    const data: Prisma.BoxUpdateInput = {};
    if (dto.boxCode !== undefined) {
      const boxCode = this.normalizeCode(dto.boxCode);
      await this.ensureUniqueBoxCode(boxCode, boxId);
      data.boxCode = boxCode;
    }
    if (dto.name !== undefined) {
      data.name = this.normalizeRequiredText(dto.name, 'Box name is required');
    }
    if (dto.notes !== undefined) {
      data.notes = this.normalizeOptionalText(dto.notes);
    }

    const box = await this.prisma.box.update({
      where: {
        id: boxId
      },
      data
    });

    await this.auditService.record({
      action: 'box.updated',
      entityType: 'box',
      entityId: box.id,
      actorUserId,
      metadata: {
        boxCode: box.boxCode,
        name: box.name
      }
    });

    return this.toBoxResponse(box as BoxWithTimestamps);
  }

  async deleteBox(boxId: string, actorUserId: string | null): Promise<{ deleted: true; id: string }> {
    const existing = await this.prisma.box.findUnique({
      where: {
        id: boxId
      }
    });

    if (!existing) {
      throw new NotFoundException('Box not found');
    }

    await this.prisma.box.delete({
      where: {
        id: boxId
      }
    });

    await this.auditService.record({
      action: 'box.deleted',
      entityType: 'box',
      entityId: boxId,
      actorUserId
    });

    return {
      deleted: true,
      id: boxId
    };
  }

  async assignBoxItems(
    boxId: string,
    dto: AssignBoxItemsDto,
    actorUserId: string | null
  ): Promise<Record<string, unknown>> {
    const box = await this.prisma.box.findUnique({
      where: {
        id: boxId
      }
    });

    if (!box) {
      throw new NotFoundException('Box not found');
    }

    const itemIds = dto.itemIds.map((value) => value.trim());
    const uniqueItemIds = new Set(itemIds);
    if (uniqueItemIds.size !== itemIds.length) {
      throw new BadRequestException('Duplicate itemIds are not allowed');
    }

    if (itemIds.length > 0) {
      const inventoryItems = await this.prisma.item.findMany({
        where: {
          id: {
            in: itemIds
          }
        },
        select: {
          id: true
        }
      });

      const existingItemIds = new Set(inventoryItems.map((item) => item.id));
      const unknownItemIds = itemIds.filter((itemId) => !existingItemIds.has(itemId));
      if (unknownItemIds.length > 0) {
        throw new BadRequestException(
          `Unknown inventory item IDs: ${unknownItemIds.join(', ')}`
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.boxItem.deleteMany({
        where: {
          boxId
        }
      });

      if (itemIds.length > 0) {
        await tx.boxItem.createMany({
          data: itemIds.map((itemId) => ({
            boxId,
            itemId
          }))
        });
      }
    });

    await this.auditService.record({
      action: 'box.items.assigned',
      entityType: 'box',
      entityId: boxId,
      actorUserId,
      metadata: {
        boxCode: box.boxCode,
        itemIds
      }
    });

    return {
      boxId,
      boxCode: box.boxCode,
      itemIds
    };
  }

  private resolveSort(
    sortBy: BoxSortField,
    sortOrder: BoxSortOrder
  ): Prisma.BoxOrderByWithRelationInput {
    if (sortBy === 'name') {
      return { name: sortOrder };
    }
    if (sortBy === 'updatedAt') {
      return { updatedAt: sortOrder };
    }
    return { boxCode: sortOrder };
  }

  private parsePositiveInteger(value: unknown, field: string, fallback: number): number {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }

    return field === 'pageSize' ? Math.min(parsed, 100) : parsed;
  }

  private normalizeCode(value: string): string {
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      throw new BadRequestException('Box code cannot be empty');
    }
    return normalized;
  }

  private normalizeRequiredText(value: string, errorMessage: string): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException(errorMessage);
    }
    return normalized;
  }

  private normalizeOptionalText(value: string | undefined): string | null {
    if (value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private formatBoxMarker(
    links: Array<{
      createdAt: Date;
      box: {
        boxCode: string;
      };
    }>
  ): string | null {
    if (links.length === 0) {
      return null;
    }

    const ordered = [...links].sort((left, right) => {
      const createdAtDiff = left.createdAt.getTime() - right.createdAt.getTime();
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }

      return left.box.boxCode.localeCompare(right.box.boxCode);
    });

    const first = ordered[0]?.box.boxCode ?? null;
    if (!first) {
      return null;
    }

    return ordered.length > 1 ? `${first} +${ordered.length - 1}` : first;
  }

  private async ensureUniqueBoxCode(boxCode: string, excludeBoxId: string | null): Promise<void> {
    const duplicate = await this.prisma.box.findFirst({
      where: {
        id: excludeBoxId
          ? {
              not: excludeBoxId
            }
          : undefined,
        boxCode: {
          equals: boxCode,
          mode: 'insensitive'
        }
      }
    });

    if (duplicate) {
      throw new ConflictException('Duplicate box code');
    }
  }

  private toBoxResponse(box: BoxWithTimestamps): Record<string, unknown> {
    return {
      id: box.id,
      boxCode: box.boxCode,
      name: box.name,
      notes: box.notes,
      createdAt: box.createdAt,
      updatedAt: box.updatedAt
    };
  }

  private async findBoxByCode(boxCode: string): Promise<BoxWithTimestamps> {
    const normalizedCode = this.normalizeCode(boxCode);
    const box = await this.prisma.box.findFirst({
      where: {
        boxCode: {
          equals: normalizedCode,
          mode: 'insensitive'
        }
      }
    });

    if (!box) {
      throw new NotFoundException('Box not found');
    }

    return box as BoxWithTimestamps;
  }
}
