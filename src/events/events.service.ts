import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { EventItemStatus, EventLifecycleStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { AddEventItemDto } from './dto/add-event-item.dto';
import { BulkUpdateEventItemStatusDto } from './dto/bulk-update-event-item-status.dto';
import {
  type EventItemSortField,
  type EventItemSortOrder,
  ListEventItemsQueryDto
} from './dto/list-event-items-query.dto';
import {
  type EventSortField,
  type EventSortOrder,
  ListEventsQueryDto
} from './dto/list-events-query.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventItemReconciliationDto } from './dto/update-event-item-reconciliation.dto';
import { UpdateEventItemStatusDto } from './dto/update-event-item-status.dto';
import { UpdateEventDto } from './dto/update-event.dto';

type EventSummaryWithItems = {
  id: string;
  name: string;
  eventDate: Date;
  location: string;
  notes: string | null;
  lifecycleStatus: EventLifecycleStatus;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    status: EventItemStatus;
    boxCode: string | null;
  }>;
};

type EventItemWithRelations = {
  id: string;
  eventId: string;
  itemId: string;
  plannedQuantity: number;
  lostQuantity: number;
  returnedQuantity: number;
  status: EventItemStatus;
  boxCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  item?: {
    id: string;
    name: string;
    code: string;
    quantity: number;
  } | null;
};

type EventWithRelations = {
  id: string;
  name: string;
  eventDate: Date;
  location: string;
  notes: string | null;
  lifecycleStatus: EventLifecycleStatus;
  createdAt: Date;
  updatedAt: Date;
  items?: EventItemWithRelations[];
};

type EventStatusCounts = Record<EventItemStatus, number>;
type PrismaTx = Prisma.TransactionClient;

const EVENT_ITEM_STATUS_LABELS: Record<EventItemStatus, string> = {
  [EventItemStatus.TO_PACK]: 'To Pack',
  [EventItemStatus.PACKED]: 'Packed',
  [EventItemStatus.RETURNED]: 'Returned',
  [EventItemStatus.LOSS]: 'Loss'
};

const EVENT_ITEM_STATUS_ORDER: EventItemStatus[] = [
  EventItemStatus.TO_PACK,
  EventItemStatus.PACKED,
  EventItemStatus.RETURNED,
  EventItemStatus.LOSS
];
const SERIALIZABLE_CONFLICT_ERROR_CODE = 'P2034';
const MAX_RECONCILIATION_RETRY_ATTEMPTS = 5;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async listEvents(query: ListEventsQueryDto = {}): Promise<Array<Record<string, unknown>>> {
    const where: Prisma.EventWhereInput = {};
    const normalizedSearch = query.search?.trim();
    if (normalizedSearch) {
      where.OR = [
        {
          name: {
            contains: normalizedSearch,
            mode: 'insensitive'
          }
        },
        {
          location: {
            contains: normalizedSearch,
            mode: 'insensitive'
          }
        }
      ];
    }

    const sortBy = query.sortBy ?? 'eventDate';
    const sortOrder = query.sortOrder ?? 'desc';

    const events = await this.prisma.event.findMany({
      where,
      include: {
        items: {
          select: {
            status: true,
            boxCode: true
          }
        }
      },
      orderBy: this.resolveEventSort(sortBy, sortOrder)
    });

    return events.map((event) => this.toEventSummaryResponse(event as EventSummaryWithItems));
  }

  async getEvent(eventId: string, query: ListEventItemsQueryDto = {}): Promise<Record<string, unknown>> {
    const event = await this.prisma.event.findUnique({
      where: {
        id: eventId
      }
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const { items, statusCounts } = await this.listEventItems(eventId, query);

    return {
      event: this.toEventDetailResponse(event as EventWithRelations, statusCounts),
      items,
      statusCounts
    };
  }

  async createEvent(dto: CreateEventDto, actorUserId: string | null): Promise<Record<string, unknown>> {
    const event = await this.prisma.event.create({
      data: {
        name: this.normalizeRequiredText(dto.name, 'Event name is required'),
        eventDate: this.parseEventDate(dto.eventDate),
        location: this.normalizeRequiredText(dto.location, 'Event location is required'),
        notes: this.normalizeOptionalText(dto.notes),
        lifecycleStatus: EventLifecycleStatus.DRAFT
      },
      include: {
        items: {
          select: {
            status: true,
            boxCode: true
          }
        }
      }
    });

    await this.auditService.record({
      action: 'event.created',
      entityType: 'event',
      entityId: event.id,
      actorUserId,
      metadata: {
        lifecycleStatus: event.lifecycleStatus
      }
    });

    return this.toEventSummaryResponse(event as EventSummaryWithItems);
  }

  async updateEvent(
    eventId: string,
    dto: UpdateEventDto,
    actorUserId: string | null
  ): Promise<Record<string, unknown>> {
    const existing = await this.ensureEventExists(eventId);
    this.ensureEventMutable(existing.lifecycleStatus);

    const data: Prisma.EventUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = this.normalizeRequiredText(dto.name, 'Event name is required');
    }
    if (dto.eventDate !== undefined) {
      data.eventDate = this.parseEventDate(dto.eventDate);
    }
    if (dto.location !== undefined) {
      data.location = this.normalizeRequiredText(dto.location, 'Event location is required');
    }
    if (dto.notes !== undefined) {
      data.notes = this.normalizeOptionalText(dto.notes);
    }

    const event = await this.prisma.event.update({
      where: {
        id: eventId
      },
      data,
      include: {
        items: {
          select: {
            status: true,
            boxCode: true
          }
        }
      }
    });

    await this.auditService.record({
      action: 'event.updated',
      entityType: 'event',
      entityId: event.id,
      actorUserId
    });

    return this.toEventSummaryResponse(event as EventSummaryWithItems);
  }

  async activateEvent(eventId: string, actorUserId: string | null): Promise<Record<string, unknown>> {
    const existing = await this.ensureEventExists(eventId);
    if (existing.lifecycleStatus === EventLifecycleStatus.CLOSED) {
      throw new BadRequestException('Closed event must be reopened by Admin before activation');
    }

    const event =
      existing.lifecycleStatus === EventLifecycleStatus.ACTIVE
        ? existing
        : await this.prisma.event.update({
            where: {
              id: eventId
            },
            data: {
              lifecycleStatus: EventLifecycleStatus.ACTIVE
            },
            include: {
              items: {
                select: {
                  status: true,
                  boxCode: true
                }
              }
            }
          });

    await this.auditService.record({
      action: 'event.activated',
      entityType: 'event',
      entityId: event.id,
      actorUserId
    });

    return this.toEventSummaryResponse(event as EventSummaryWithItems);
  }

  async closeEvent(eventId: string, actorUserId: string | null): Promise<Record<string, unknown>> {
    const existing = await this.ensureEventExists(eventId);

    const event =
      existing.lifecycleStatus === EventLifecycleStatus.CLOSED
        ? existing
        : await this.prisma.event.update({
            where: {
              id: eventId
            },
            data: {
              lifecycleStatus: EventLifecycleStatus.CLOSED
            },
            include: {
              items: {
                select: {
                  status: true,
                  boxCode: true
                }
              }
            }
          });

    await this.auditService.record({
      action: 'event.closed',
      entityType: 'event',
      entityId: event.id,
      actorUserId
    });

    return this.toEventSummaryResponse(event as EventSummaryWithItems);
  }

  async reopenEvent(
    eventId: string,
    actorUserId: string | null,
    actorRole: string | null
  ): Promise<Record<string, unknown>> {
    if (actorRole !== 'ADMIN') {
      throw new ForbiddenException('Only Admin can reopen closed events');
    }

    const existing = await this.ensureEventExists(eventId);
    if (existing.lifecycleStatus !== EventLifecycleStatus.CLOSED) {
      throw new BadRequestException('Only closed events can be reopened');
    }

    const event = await this.prisma.event.update({
      where: {
        id: eventId
      },
      data: {
        lifecycleStatus: EventLifecycleStatus.ACTIVE
      },
      include: {
        items: {
          select: {
            status: true,
            boxCode: true
          }
        }
      }
    });

    await this.auditService.record({
      action: 'event.reopened',
      entityType: 'event',
      entityId: event.id,
      actorUserId
    });

    return this.toEventSummaryResponse(event as EventSummaryWithItems);
  }

  async addEventItem(
    eventId: string,
    dto: AddEventItemDto,
    actorUserId: string | null
  ): Promise<Record<string, unknown>> {
    const event = await this.ensureEventExists(eventId);
    this.ensureEventMutable(event.lifecycleStatus);

    const plannedQuantity = Number(dto.plannedQuantity);
    if (!Number.isInteger(plannedQuantity) || plannedQuantity <= 0) {
      throw new BadRequestException('plannedQuantity must be a positive integer');
    }

    const item = await this.prisma.item.findUnique({
      where: {
        id: dto.itemId
      }
    });
    if (!item) {
      throw new BadRequestException('Inventory item not found');
    }

    const existing = await this.prisma.eventItem.findFirst({
      where: {
        eventId,
        itemId: dto.itemId
      }
    });
    if (existing) {
      throw new ConflictException('Item already added to this event');
    }

    const eventItem = await this.prisma.eventItem.create({
      data: {
        eventId,
        itemId: dto.itemId,
        plannedQuantity,
        status: EventItemStatus.TO_PACK
      },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            code: true,
            quantity: true
          }
        }
      }
    });

    await this.auditService.record({
      action: 'event.item.added',
      entityType: 'event_item',
      entityId: eventItem.id,
      actorUserId,
      metadata: {
        eventId,
        itemId: dto.itemId,
        plannedQuantity
      }
    });

    return this.toEventItemResponse(eventItem as EventItemWithRelations);
  }

  async addBoxToEvent(
    eventId: string,
    boxId: string,
    actorUserId: string | null
  ): Promise<Record<string, unknown>> {
    const event = await this.ensureEventExists(eventId);
    this.ensureEventMutable(event.lifecycleStatus);
    const box = await this.ensureBoxExists(boxId);

    const boxItems = await this.prisma.boxItem.findMany({
      where: {
        boxId
      },
      select: {
        itemId: true
      }
    });
    const itemIds = boxItems.map((row) => row.itemId);

    try {
      const stats = await this.prisma.$transaction(
        async (tx) => {
          await tx.eventBox.create({
            data: {
              eventId,
              boxId
            }
          });

          return this.linkBoxItemsToEvent(tx, eventId, boxId, itemIds);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      await this.auditService.record({
        action: 'event.box.added',
        entityType: 'event_box',
        entityId: `${eventId}:${boxId}`,
        actorUserId,
        metadata: {
          eventId,
          boxId,
          boxCode: box.boxCode,
          createdItems: stats.createdItems,
          linkedExistingItems: stats.linkedExistingItems
        }
      });

      return {
        eventId,
        boxId,
        boxCode: box.boxCode,
        createdItems: stats.createdItems,
        linkedExistingItems: stats.linkedExistingItems,
        totalAssignedItems: itemIds.length
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Box already added to this event');
      }
      throw error;
    }
  }

  async addMissingBoxItems(
    eventId: string,
    boxId: string,
    actorUserId: string | null
  ): Promise<Record<string, unknown>> {
    const event = await this.ensureEventExists(eventId);
    this.ensureEventMutable(event.lifecycleStatus);
    const box = await this.ensureBoxExists(boxId);

    const existingLink = await this.prisma.eventBox.findUnique({
      where: {
        eventId_boxId: {
          eventId,
          boxId
        }
      }
    });
    if (!existingLink) {
      throw new BadRequestException('Box is not linked to this event');
    }

    const boxItems = await this.prisma.boxItem.findMany({
      where: {
        boxId
      },
      select: {
        itemId: true
      }
    });
    const itemIds = boxItems.map((row) => row.itemId);

    const stats = await this.prisma.$transaction(
      async (tx) => this.linkBoxItemsToEvent(tx, eventId, boxId, itemIds),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );

    await this.auditService.record({
      action: 'event.box.items.add_missing',
      entityType: 'event_box',
      entityId: `${eventId}:${boxId}`,
      actorUserId,
      metadata: {
        eventId,
        boxId,
        boxCode: box.boxCode,
        createdItems: stats.createdItems,
        linkedExistingItems: stats.linkedExistingItems
      }
    });

    return {
      eventId,
      boxId,
      boxCode: box.boxCode,
      createdItems: stats.createdItems,
      linkedExistingItems: stats.linkedExistingItems,
      totalAssignedItems: itemIds.length
    };
  }

  async removeBoxFromEvent(
    eventId: string,
    boxId: string,
    actorUserId: string | null
  ): Promise<Record<string, unknown>> {
    const event = await this.ensureEventExists(eventId);
    this.ensureEventMutable(event.lifecycleStatus);
    const box = await this.ensureBoxExists(boxId);

    const existingLink = await this.prisma.eventBox.findUnique({
      where: {
        eventId_boxId: {
          eventId,
          boxId
        }
      }
    });
    if (!existingLink) {
      throw new NotFoundException('Box is not linked to this event');
    }

    const stats = await this.prisma.$transaction(
      async (tx) => {
        const linkedRows = await tx.eventItemBox.findMany({
          where: {
            boxId,
            eventItem: {
              eventId
            }
          },
          select: {
            eventItemId: true
          }
        });

        const removedLinkCount = linkedRows.length;
        const affectedEventItemIds = [...new Set(linkedRows.map((row) => row.eventItemId))];

        await tx.eventItemBox.deleteMany({
          where: {
            boxId,
            eventItem: {
              eventId
            }
          }
        });

        await tx.eventBox.delete({
          where: {
            eventId_boxId: {
              eventId,
              boxId
            }
          }
        });

        for (const eventItemId of affectedEventItemIds) {
          await this.syncEventItemBoxCode(tx, eventItemId);
        }

        return {
          removedLinkCount,
          affectedEventItems: affectedEventItemIds.length
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );

    await this.auditService.record({
      action: 'event.box.removed',
      entityType: 'event_box',
      entityId: `${eventId}:${boxId}`,
      actorUserId,
      metadata: {
        eventId,
        boxId,
        boxCode: box.boxCode,
        removedLinkCount: stats.removedLinkCount,
        affectedEventItems: stats.affectedEventItems
      }
    });

    return {
      eventId,
      boxId,
      boxCode: box.boxCode,
      removedLinkCount: stats.removedLinkCount,
      affectedEventItems: stats.affectedEventItems
    };
  }

  async removeEventItem(
    eventId: string,
    eventItemId: string,
    actorUserId: string | null
  ): Promise<{ deleted: true; id: string; eventId: string }> {
    const event = await this.ensureEventExists(eventId);
    this.ensureEventMutable(event.lifecycleStatus);

    const eventItem = await this.prisma.eventItem.findFirst({
      where: {
        id: eventItemId,
        eventId
      }
    });
    if (!eventItem) {
      throw new NotFoundException('Event item not found in this event');
    }

    await this.prisma.eventItem.delete({
      where: {
        id: eventItem.id
      }
    });

    await this.auditService.record({
      action: 'event.item.removed',
      entityType: 'event_item',
      entityId: eventItemId,
      actorUserId,
      metadata: {
        eventId
      }
    });

    return {
      deleted: true,
      id: eventItemId,
      eventId
    };
  }

  async listEventItems(
    eventId: string,
    query: ListEventItemsQueryDto = {}
  ): Promise<{ items: Array<Record<string, unknown>>; statusCounts: EventStatusCounts }> {
    const event = await this.prisma.event.findUnique({
      where: {
        id: eventId
      },
      include: {
        items: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                code: true,
                quantity: true
              }
            }
          }
        }
      }
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const allItems = (event.items ?? []) as EventItemWithRelations[];
    const statusCounts = this.computeStatusCounts(allItems);
    const filteredItems = this.applyEventItemQuery(allItems, query);

    return {
      items: filteredItems.map((row) => this.toEventItemResponse(row)),
      statusCounts
    };
  }

  async updateItemStatus(
    eventId: string,
    eventItemId: string,
    dto: UpdateEventItemStatusDto,
    actorUserId: string | null
  ): Promise<Record<string, unknown>> {
    const event = await this.ensureEventExists(eventId);
    this.ensureEventActive(event.lifecycleStatus);

    const eventItem = await this.prisma.eventItem.findFirst({
      where: {
        id: eventItemId,
        eventId
      },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            code: true,
            quantity: true
          }
        }
      }
    });
    if (!eventItem) {
      throw new NotFoundException('Event item not found in this event');
    }

    this.assertTransitionAllowed(eventItem.status, dto.status, dto.forceToPack === true);

    const updated = await this.prisma.eventItem.update({
      where: {
        id: eventItem.id
      },
      data: {
        status: dto.status
      },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            code: true,
            quantity: true
          }
        }
      }
    });

    await this.auditService.record({
      action: 'event.item.status.updated',
      entityType: 'event_item',
      entityId: eventItem.id,
      actorUserId,
      metadata: {
        eventId,
        fromStatus: eventItem.status,
        toStatus: dto.status,
        forceToPack: dto.forceToPack === true
      }
    });

    return this.toEventItemResponse(updated as EventItemWithRelations);
  }

  async updateItemReconciliation(
    eventId: string,
    eventItemId: string,
    dto: UpdateEventItemReconciliationDto,
    actorUserId: string | null
  ): Promise<Record<string, unknown>> {
    const event = await this.ensureEventExists(eventId);
    this.ensureEventReconciliationAllowed(event.lifecycleStatus);

    const result = await this.runSerializableWithRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          const eventItem = await tx.eventItem.findFirst({
            where: {
              id: eventItemId,
              eventId
            },
            include: {
              item: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  quantity: true
                }
              }
            }
          });
          if (!eventItem) {
            throw new NotFoundException('Event item not found in this event');
          }
          if (!eventItem.item) {
            throw new NotFoundException('Inventory item not found');
          }

          const nextLostQuantity = this.validateReconciliationQuantity(
            dto.lostQuantity,
            'lostQuantity',
            eventItem.plannedQuantity
          );
          const nextReturnedQuantity = this.validateReconciliationQuantity(
            dto.returnedQuantity,
            'returnedQuantity',
            eventItem.plannedQuantity
          );

          const previousLostQuantity = eventItem.lostQuantity ?? 0;
          const previousReturnedQuantity = eventItem.returnedQuantity ?? 0;
          const lossDelta = nextLostQuantity - previousLostQuantity;
          const beforeItemQuantity = eventItem.item.quantity;
          let afterItemQuantity = beforeItemQuantity;
          let stockDelta = 0;

          if (lossDelta !== 0) {
            afterItemQuantity = beforeItemQuantity - lossDelta;
            if (afterItemQuantity < 0) {
              throw new BadRequestException('Insufficient stock for reconciliation delta');
            }

            await tx.item.update({
              where: {
                id: eventItem.itemId
              },
              data: {
                quantity: afterItemQuantity
              }
            });

            stockDelta = afterItemQuantity - beforeItemQuantity;

            await tx.stockAdjustment.create({
              data: {
                itemId: eventItem.itemId,
                actorUserId,
                reason: `event:${eventId}:reconciliation`,
                beforeQuantity: beforeItemQuantity,
                afterQuantity: afterItemQuantity,
                delta: stockDelta
              }
            });
          }

          const updated = await tx.eventItem.update({
            where: {
              id: eventItem.id
            },
            data: {
              lostQuantity: nextLostQuantity,
              returnedQuantity: nextReturnedQuantity
            },
            include: {
              item: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  quantity: true
                }
              }
            }
          });

          return {
            updated,
            metadata: {
              previousLostQuantity,
              nextLostQuantity,
              previousReturnedQuantity,
              nextReturnedQuantity,
              stockDelta,
              beforeItemQuantity,
              afterItemQuantity
            }
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      )
    );

    await this.auditService.record({
      action: 'event.item.reconciliation.updated',
      entityType: 'event_item',
      entityId: eventItemId,
      actorUserId,
      metadata: {
        eventId,
        ...result.metadata
      }
    });

    return this.toEventItemResponse(result.updated as EventItemWithRelations);
  }

  async bulkUpdateItemStatus(
    eventId: string,
    dto: BulkUpdateEventItemStatusDto,
    actorUserId: string | null
  ): Promise<Array<Record<string, unknown>>> {
    const event = await this.ensureEventExists(eventId);
    this.ensureEventActive(event.lifecycleStatus);

    const uniqueIds = new Set<string>();
    for (const id of dto.eventItemIds) {
      if (uniqueIds.has(id)) {
        throw new BadRequestException('Duplicate event item in status/bulk payload');
      }
      uniqueIds.add(id);
    }

    const rows = await this.prisma.eventItem.findMany({
      where: {
        eventId,
        id: {
          in: dto.eventItemIds
        }
      },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            code: true,
            quantity: true
          }
        }
      }
    });

    if (rows.length !== dto.eventItemIds.length) {
      throw new BadRequestException('Some event items were not found in this event');
    }

    for (const row of rows) {
      this.assertTransitionAllowed(row.status, dto.status, dto.forceToPack === true);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        await tx.eventItem.update({
          where: {
            id: row.id
          },
          data: {
            status: dto.status
          }
        });
      }
    });

    const updatedRows = await this.prisma.eventItem.findMany({
      where: {
        eventId,
        id: {
          in: dto.eventItemIds
        }
      },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            code: true,
            quantity: true
          }
        }
      }
    });

    await this.auditService.record({
      action: 'event.item.status.bulk.updated',
      entityType: 'event',
      entityId: eventId,
      actorUserId,
      metadata: {
        eventItemIds: dto.eventItemIds,
        toStatus: dto.status,
        forceToPack: dto.forceToPack === true
      }
    });

    return updatedRows.map((row) => this.toEventItemResponse(row as EventItemWithRelations));
  }

  private async ensureEventExists(eventId: string): Promise<EventWithRelations> {
    const event = await this.prisma.event.findUnique({
      where: {
        id: eventId
      },
      include: {
        items: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                code: true,
                quantity: true
              }
            }
          }
        }
      }
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event as EventWithRelations;
  }

  private ensureEventMutable(lifecycleStatus: EventLifecycleStatus): void {
    if (lifecycleStatus === EventLifecycleStatus.CLOSED) {
      throw new BadRequestException('Closed event is read-only');
    }
  }

  private ensureEventActive(lifecycleStatus: EventLifecycleStatus): void {
    if (lifecycleStatus !== EventLifecycleStatus.ACTIVE) {
      throw new BadRequestException('Event must be ACTIVE to change item statuses');
    }
  }

  private ensureEventReconciliationAllowed(lifecycleStatus: EventLifecycleStatus): void {
    const allowedStates: EventLifecycleStatus[] = [
      EventLifecycleStatus.DRAFT,
      EventLifecycleStatus.ACTIVE,
      EventLifecycleStatus.CLOSED
    ];
    if (!allowedStates.includes(lifecycleStatus)) {
      throw new BadRequestException('Event does not allow reconciliation updates');
    }
  }

  private validateReconciliationQuantity(
    value: number,
    fieldName: 'lostQuantity' | 'returnedQuantity',
    plannedQuantity: number
  ): number {
    if (!Number.isInteger(value)) {
      throw new BadRequestException(`${fieldName} must be an integer`);
    }

    if (value < 0 || value > plannedQuantity) {
      throw new BadRequestException(`${fieldName} must be between 0 and plannedQuantity`);
    }

    return value;
  }

  private assertTransitionAllowed(
    currentStatus: EventItemStatus,
    targetStatus: EventItemStatus,
    forceToPack: boolean
  ): void {
    if (currentStatus === targetStatus) {
      return;
    }

    if (targetStatus === EventItemStatus.TO_PACK) {
      if (!forceToPack) {
        throw new BadRequestException('Transition to TO_PACK requires forceToPack=true');
      }
      return;
    }

    const allowed: Record<EventItemStatus, EventItemStatus[]> = {
      [EventItemStatus.TO_PACK]: [EventItemStatus.PACKED],
      [EventItemStatus.PACKED]: [EventItemStatus.RETURNED, EventItemStatus.LOSS],
      [EventItemStatus.RETURNED]: [],
      [EventItemStatus.LOSS]: []
    };

    const supported = allowed[currentStatus] ?? [];
    if (!supported.includes(targetStatus)) {
      throw new BadRequestException(`Invalid status transition: ${currentStatus} -> ${targetStatus}`);
    }
  }

  private async ensureBoxExists(boxId: string): Promise<{ id: string; boxCode: string }> {
    const box = await this.prisma.box.findUnique({
      where: {
        id: boxId
      },
      select: {
        id: true,
        boxCode: true
      }
    });
    if (!box) {
      throw new NotFoundException('Box not found');
    }
    return box;
  }

  private async linkBoxItemsToEvent(
    tx: PrismaTx,
    eventId: string,
    boxId: string,
    itemIds: string[]
  ): Promise<{ createdItems: number; linkedExistingItems: number }> {
    let createdItems = 0;
    let linkedExistingItems = 0;
    const affectedEventItemIds: string[] = [];

    for (const itemId of itemIds) {
      const existingRow = await tx.eventItem.findFirst({
        where: {
          eventId,
          itemId
        }
      });

      let eventItemId: string;
      if (existingRow) {
        eventItemId = existingRow.id;
      } else {
        const created = await tx.eventItem.create({
          data: {
            eventId,
            itemId,
            plannedQuantity: 1,
            status: EventItemStatus.TO_PACK
          },
          select: {
            id: true
          }
        });
        eventItemId = created.id;
        createdItems += 1;
      }

      const existingLink = await tx.eventItemBox.findFirst({
        where: {
          eventItemId,
          boxId
        },
        select: {
          eventItemId: true
        }
      });

      if (!existingLink) {
        await tx.eventItemBox.create({
          data: {
            eventItemId,
            boxId
          }
        });
      }

      if (existingRow) {
        linkedExistingItems += 1;
      }
      affectedEventItemIds.push(eventItemId);
    }

    for (const eventItemId of new Set(affectedEventItemIds)) {
      await this.syncEventItemBoxCode(tx, eventItemId);
    }

    return {
      createdItems,
      linkedExistingItems
    };
  }

  private async syncEventItemBoxCode(tx: PrismaTx, eventItemId: string): Promise<void> {
    const linkedBoxes = await tx.eventItemBox.findMany({
      where: {
        eventItemId
      },
      include: {
        box: {
          select: {
            boxCode: true
          }
        }
      },
      orderBy: [
        {
          createdAt: 'asc'
        },
        {
          box: {
            boxCode: 'asc'
          }
        }
      ]
    });

    const firstBoxCode = linkedBoxes[0]?.box.boxCode ?? null;
    const displayBoxCode =
      firstBoxCode && linkedBoxes.length > 1
        ? `${firstBoxCode} +${linkedBoxes.length - 1}`
        : firstBoxCode;

    await tx.eventItem.update({
      where: {
        id: eventItemId
      },
      data: {
        boxCode: displayBoxCode
      }
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const prismaError = error as {
      code?: string;
    };
    return prismaError.code === 'P2002';
  }

  private async runSerializableWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= MAX_RECONCILIATION_RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const isRetryable = this.isSerializableConflictError(error);
        if (!isRetryable || attempt === MAX_RECONCILIATION_RETRY_ATTEMPTS) {
          throw error;
        }
      }
    }

    throw new ConflictException('Reconciliation transaction retries exhausted');
  }

  private isSerializableConflictError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const prismaError = error as {
      code?: string;
    };
    return prismaError.code === SERIALIZABLE_CONFLICT_ERROR_CODE;
  }

  private resolveEventSort(
    sortBy: EventSortField,
    sortOrder: EventSortOrder
  ): Prisma.EventOrderByWithRelationInput {
    if (sortBy === 'updatedAt') {
      return {
        updatedAt: sortOrder
      };
    }

    if (sortBy === 'name') {
      return {
        name: sortOrder
      };
    }

    return {
      eventDate: sortOrder
    };
  }

  private applyEventItemQuery(
    rows: EventItemWithRelations[],
    query: ListEventItemsQueryDto
  ): EventItemWithRelations[] {
    const normalizedSearch = query.search?.trim().toLowerCase();
    let filtered = [...rows];

    if (normalizedSearch) {
      filtered = filtered.filter((row) => {
        const itemName = row.item?.name.toLowerCase() ?? '';
        const itemCode = row.item?.code.toLowerCase() ?? '';
        return itemName.includes(normalizedSearch) || itemCode.includes(normalizedSearch);
      });
    }

    if (query.status) {
      filtered = filtered.filter((row) => row.status === query.status);
    }

    if (query.unresolvedOnly === true) {
      filtered = filtered.filter((row) => row.status === EventItemStatus.TO_PACK);
    }

    const sortBy = query.sortBy ?? 'name';
    const sortOrder = query.sortOrder ?? 'asc';

    filtered.sort((left, right) => this.compareEventItems(left, right, sortBy, sortOrder));
    return filtered;
  }

  private compareEventItems(
    left: EventItemWithRelations,
    right: EventItemWithRelations,
    sortBy: EventItemSortField,
    sortOrder: EventItemSortOrder
  ): number {
    let comparison = 0;

    if (sortBy === 'plannedQuantity') {
      comparison = left.plannedQuantity - right.plannedQuantity;
    } else if (sortBy === 'status') {
      comparison =
        EVENT_ITEM_STATUS_ORDER.indexOf(left.status) - EVENT_ITEM_STATUS_ORDER.indexOf(right.status);
    } else {
      comparison = (left.item?.name ?? '').localeCompare(right.item?.name ?? '');
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  }

  private computeStatusCounts(rows: EventItemWithRelations[]): EventStatusCounts {
    const counts: EventStatusCounts = {
      [EventItemStatus.TO_PACK]: 0,
      [EventItemStatus.PACKED]: 0,
      [EventItemStatus.RETURNED]: 0,
      [EventItemStatus.LOSS]: 0
    };

    for (const row of rows) {
      counts[row.status] += 1;
    }

    return counts;
  }

  private toEventSummaryResponse(event: EventSummaryWithItems): Record<string, unknown> {
    const statusCounts = this.computeStatusCounts(
      event.items.map((item) => ({
        id: '',
        eventId: event.id,
        itemId: '',
        plannedQuantity: 0,
        lostQuantity: 0,
        returnedQuantity: 0,
        status: item.status,
        boxCode: item.boxCode,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        item: null
      }))
    );

    return {
      id: event.id,
      name: event.name,
      eventDate: event.eventDate,
      location: event.location,
      notes: event.notes,
      lifecycleStatus: event.lifecycleStatus,
      itemCount: event.items.length,
      statusCounts,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt
    };
  }

  private toEventDetailResponse(
    event: EventWithRelations,
    statusCounts: EventStatusCounts
  ): Record<string, unknown> {
    return {
      id: event.id,
      name: event.name,
      eventDate: event.eventDate,
      location: event.location,
      notes: event.notes,
      lifecycleStatus: event.lifecycleStatus,
      statusCounts,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt
    };
  }

  private toEventItemResponse(row: EventItemWithRelations): Record<string, unknown> {
    const boxCode = row.boxCode ?? null;

    return {
      id: row.id,
      eventId: row.eventId,
      itemId: row.itemId,
      itemName: row.item?.name ?? null,
      itemCode: row.item?.code ?? null,
      plannedQuantity: row.plannedQuantity,
      lostQuantity: row.lostQuantity,
      returnedQuantity: row.returnedQuantity,
      status: row.status,
      statusLabel: EVENT_ITEM_STATUS_LABELS[row.status],
      boxCode,
      boxLabel: boxCode ?? 'No box',
      boxWarning: boxCode ? null : 'NO_BOX_LINK',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  private parseEventDate(value: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid eventDate');
    }
    return parsed;
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
}
