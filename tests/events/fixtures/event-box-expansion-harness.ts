import { EventItemStatus, EventLifecycleStatus } from '@prisma/client';

type EventRecord = {
  id: string;
  name: string;
  eventDate: Date;
  location: string;
  notes: string | null;
  lifecycleStatus: EventLifecycleStatus;
  createdAt: Date;
  updatedAt: Date;
};

type ItemRecord = {
  id: string;
  name: string;
  code: string;
  quantity: number;
};

type BoxRecord = {
  id: string;
  boxCode: string;
  name: string;
};

type BoxItemRecord = {
  boxId: string;
  itemId: string;
  createdAt: Date;
};

type EventItemRecord = {
  id: string;
  eventId: string;
  itemId: string;
  plannedQuantity: number;
  status: EventItemStatus;
  boxCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type EventBoxRecord = {
  eventId: string;
  boxId: string;
  createdAt: Date;
};

type EventItemBoxRecord = {
  eventItemId: string;
  boxId: string;
  createdAt: Date;
};

type StockAdjustmentRecord = {
  id: string;
  itemId: string;
  beforeQuantity: number;
  afterQuantity: number;
  delta: number;
};

const FIXED_LINKED_AT = new Date('2026-01-01T00:00:00.000Z');

function eventItemWithOptionalItem(
  row: EventItemRecord,
  items: ItemRecord[],
  includeItem: boolean
): EventItemRecord & { item?: ItemRecord } {
  if (!includeItem) {
    return { ...row };
  }

  const item = items.find((entry) => entry.id === row.itemId);
  return {
    ...row,
    item: item ? { ...item } : undefined
  };
}

function withIncludedItems(
  event: EventRecord,
  eventItems: EventItemRecord[],
  items: ItemRecord[],
  includeConfig: unknown
): EventRecord & { items?: unknown[] } {
  if (!includeConfig || typeof includeConfig !== 'object') {
    return { ...event };
  }

  const includeItem =
    'include' in (includeConfig as Record<string, unknown>) &&
    Boolean((includeConfig as { include?: Record<string, unknown> }).include?.item);

  const rows = eventItems
    .filter((entry) => entry.eventId === event.id)
    .map((entry) => {
      if (includeItem) {
        return eventItemWithOptionalItem(entry, items, true);
      }
      return {
        status: entry.status,
        boxCode: entry.boxCode
      };
    });

  return {
    ...event,
    items: rows
  };
}

function matchesWhere(event: EventRecord, where: Record<string, unknown> | undefined): boolean {
  if (!where) {
    return true;
  }

  const orConditions = where.OR as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(orConditions) && orConditions.length > 0) {
    const normalizedName = event.name.toLowerCase();
    const normalizedLocation = event.location.toLowerCase();
    const matched = orConditions.some((condition) => {
      const nameContains =
        (condition.name as { contains?: string } | undefined)?.contains?.toLowerCase() ?? null;
      const locationContains =
        (condition.location as { contains?: string } | undefined)?.contains?.toLowerCase() ?? null;

      const nameMatch = nameContains ? normalizedName.includes(nameContains) : false;
      const locationMatch = locationContains ? normalizedLocation.includes(locationContains) : false;

      return nameMatch || locationMatch;
    });

    if (!matched) {
      return false;
    }
  }

  return true;
}

function pickSelected<T extends Record<string, unknown>>(
  row: T,
  select: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!select) {
    return { ...row };
  }

  const picked: Record<string, unknown> = {};
  for (const key of Object.keys(select)) {
    if (select[key]) {
      picked[key] = row[key];
    }
  }
  return picked;
}

export function createEventBoxExpansionHarness() {
  const events: EventRecord[] = [];
  const eventItems: EventItemRecord[] = [];
  const eventBoxes: EventBoxRecord[] = [];
  const eventItemBoxes: EventItemBoxRecord[] = [];
  const stockAdjustments: StockAdjustmentRecord[] = [];

  const items: ItemRecord[] = [
    { id: 'item-1', name: 'Cable', code: 'ITM-0001', quantity: 10 },
    { id: 'item-2', name: 'Speaker', code: 'ITM-0002', quantity: 5 },
    { id: 'item-3', name: 'Lamp', code: 'ITM-0003', quantity: 4 }
  ];

  const boxes: BoxRecord[] = [
    { id: 'box-1', boxCode: 'BX-001', name: 'Audio Box' },
    { id: 'box-2', boxCode: 'BX-002', name: 'Lights Box' }
  ];

  const boxItems: BoxItemRecord[] = [
    { boxId: 'box-1', itemId: 'item-1', createdAt: new Date('2026-01-01T00:00:00.000Z') },
    { boxId: 'box-1', itemId: 'item-2', createdAt: new Date('2026-01-01T00:00:00.000Z') },
    { boxId: 'box-2', itemId: 'item-1', createdAt: new Date('2026-01-01T00:00:00.000Z') }
  ];

  const prisma = {
    event: {
      findMany: jest.fn(
        async ({
          where,
          include,
          orderBy
        }: {
          where?: Record<string, unknown>;
          include?: {
            items?: unknown;
          };
          orderBy?: {
            eventDate?: 'asc' | 'desc';
            updatedAt?: 'asc' | 'desc';
            name?: 'asc' | 'desc';
          };
        } = {}) => {
          let selected = events.filter((entry) => matchesWhere(entry, where));

          if (orderBy?.eventDate) {
            selected = [...selected].sort((left, right) => {
              const delta = left.eventDate.getTime() - right.eventDate.getTime();
              return orderBy.eventDate === 'asc' ? delta : -delta;
            });
          } else if (orderBy?.updatedAt) {
            selected = [...selected].sort((left, right) => {
              const delta = left.updatedAt.getTime() - right.updatedAt.getTime();
              return orderBy.updatedAt === 'asc' ? delta : -delta;
            });
          } else if (orderBy?.name) {
            selected = [...selected].sort((left, right) => {
              const delta = left.name.localeCompare(right.name);
              return orderBy.name === 'asc' ? delta : -delta;
            });
          }

          return selected.map((event) => withIncludedItems(event, eventItems, items, include?.items));
        }
      ),
      findUnique: jest.fn(
        async ({
          where,
          include
        }: {
          where: {
            id: string;
          };
          include?: {
            items?: unknown;
          };
        }) => {
          const event = events.find((entry) => entry.id === where.id);
          if (!event) {
            return null;
          }
          return withIncludedItems(event, eventItems, items, include?.items);
        }
      ),
      create: jest.fn(
        async ({
          data,
          include
        }: {
          data: {
            name: string;
            eventDate: Date;
            location: string;
            notes: string | null;
            lifecycleStatus: EventLifecycleStatus;
          };
          include?: {
            items?: unknown;
          };
        }) => {
          const now = new Date();
          const event: EventRecord = {
            id: `evt-${events.length + 1}`,
            name: data.name,
            eventDate: data.eventDate,
            location: data.location,
            notes: data.notes,
            lifecycleStatus: data.lifecycleStatus,
            createdAt: now,
            updatedAt: now
          };
          events.push(event);
          return withIncludedItems(event, eventItems, items, include?.items);
        }
      ),
      update: jest.fn(
        async ({
          where,
          data,
          include
        }: {
          where: {
            id: string;
          };
          data: {
            name?: string;
            eventDate?: Date;
            location?: string;
            notes?: string | null;
            lifecycleStatus?: EventLifecycleStatus;
          };
          include?: {
            items?: unknown;
          };
        }) => {
          const event = events.find((entry) => entry.id === where.id);
          if (!event) {
            throw new Error('event not found');
          }

          if (data.name !== undefined) {
            event.name = data.name;
          }
          if (data.eventDate !== undefined) {
            event.eventDate = data.eventDate;
          }
          if (data.location !== undefined) {
            event.location = data.location;
          }
          if (data.notes !== undefined) {
            event.notes = data.notes;
          }
          if (data.lifecycleStatus !== undefined) {
            event.lifecycleStatus = data.lifecycleStatus;
          }
          event.updatedAt = new Date();

          return withIncludedItems(event, eventItems, items, include?.items);
        }
      )
    },
    eventItem: {
      findFirst: jest.fn(
        async ({
          where,
          include,
          select
        }: {
          where: {
            id?: string;
            eventId?: string;
            itemId?: string;
          };
          include?: {
            item?: unknown;
          };
          select?: Record<string, unknown>;
        }) => {
          const row =
            eventItems.find((entry) => {
              const idMatch = where.id ? entry.id === where.id : true;
              const eventMatch = where.eventId ? entry.eventId === where.eventId : true;
              const itemMatch = where.itemId ? entry.itemId === where.itemId : true;
              return idMatch && eventMatch && itemMatch;
            }) ?? null;

          if (!row) {
            return null;
          }

          if (select) {
            return pickSelected(row as unknown as Record<string, unknown>, select);
          }

          return eventItemWithOptionalItem(row, items, Boolean(include?.item));
        }
      ),
      findMany: jest.fn(
        async ({
          where,
          include,
          select
        }: {
          where?: {
            eventId?: string;
            itemId?: string | { in: string[] };
            id?: {
              in: string[];
            };
          };
          include?: {
            item?: unknown;
          };
          select?: Record<string, unknown>;
        } = {}) => {
          let selected = [...eventItems];
          if (where?.eventId) {
            selected = selected.filter((entry) => entry.eventId === where.eventId);
          }
          if (where?.itemId && typeof where.itemId === 'string') {
            selected = selected.filter((entry) => entry.itemId === where.itemId);
          }
          if (where?.itemId && typeof where.itemId === 'object' && 'in' in where.itemId) {
            selected = selected.filter((entry) => where.itemId.in.includes(entry.itemId));
          }
          if (where?.id?.in) {
            selected = selected.filter((entry) => where.id!.in.includes(entry.id));
          }

          if (select) {
            return selected.map((entry) =>
              pickSelected(entry as unknown as Record<string, unknown>, select)
            );
          }

          return selected.map((entry) => eventItemWithOptionalItem(entry, items, Boolean(include?.item)));
        }
      ),
      create: jest.fn(
        async ({
          data,
          include,
          select
        }: {
          data: {
            eventId: string;
            itemId: string;
            plannedQuantity: number;
            status: EventItemStatus;
            boxCode?: string | null;
          };
          include?: {
            item?: unknown;
          };
          select?: Record<string, unknown>;
        }) => {
          const now = new Date();
          const row: EventItemRecord = {
            id: `evt-item-${eventItems.length + 1}`,
            eventId: data.eventId,
            itemId: data.itemId,
            plannedQuantity: data.plannedQuantity,
            status: data.status,
            boxCode: data.boxCode ?? null,
            createdAt: now,
            updatedAt: now
          };
          eventItems.push(row);

          if (select) {
            return pickSelected(row as unknown as Record<string, unknown>, select);
          }

          return eventItemWithOptionalItem(row, items, Boolean(include?.item));
        }
      ),
      update: jest.fn(
        async ({
          where,
          data,
          include
        }: {
          where: {
            id: string;
          };
          data: {
            status?: EventItemStatus;
            boxCode?: string | null;
          };
          include?: {
            item?: unknown;
          };
        }) => {
          const row = eventItems.find((entry) => entry.id === where.id);
          if (!row) {
            throw new Error('event item not found');
          }

          if (data.status !== undefined) {
            row.status = data.status;
          }
          if (data.boxCode !== undefined) {
            row.boxCode = data.boxCode;
          }
          row.updatedAt = new Date();

          return eventItemWithOptionalItem(row, items, Boolean(include?.item));
        }
      ),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const index = eventItems.findIndex((entry) => entry.id === where.id);
        if (index < 0) {
          throw new Error('event item not found');
        }
        const [row] = eventItems.splice(index, 1);
        return row;
      })
    },
    item: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return items.find((entry) => entry.id === where.id) ?? null;
      }),
      findMany: jest.fn(
        async ({
          where
        }: {
          where: {
            id: {
              in: string[];
            };
          };
        }) => items.filter((entry) => where.id.in.includes(entry.id)).map((entry) => ({ ...entry }))
      ),
      update: jest.fn(
        async ({
          where,
          data
        }: {
          where: {
            id: string;
          };
          data: {
            quantity?: number;
          };
        }) => {
          const item = items.find((entry) => entry.id === where.id);
          if (!item) {
            throw new Error('item not found');
          }
          if (data.quantity !== undefined) {
            item.quantity = data.quantity;
          }
          return { ...item };
        }
      )
    },
    box: {
      findUnique: jest.fn(
        async ({
          where,
          select
        }: {
          where: {
            id: string;
          };
          select?: Record<string, unknown>;
        }) => {
          const box = boxes.find((entry) => entry.id === where.id);
          if (!box) {
            return null;
          }
          if (select) {
            return pickSelected(box as unknown as Record<string, unknown>, select);
          }
          return { ...box };
        }
      )
    },
    boxItem: {
      findMany: jest.fn(
        async ({
          where,
          select
        }: {
          where: {
            boxId: string;
          };
          select?: Record<string, unknown>;
        }) => {
          const rows = boxItems.filter((entry) => entry.boxId === where.boxId);
          if (select) {
            return rows.map((entry) => pickSelected(entry as unknown as Record<string, unknown>, select));
          }
          return rows.map((entry) => ({ ...entry }));
        }
      )
    },
    eventBox: {
      findUnique: jest.fn(
        async ({
          where
        }: {
          where: {
            eventId_boxId: {
              eventId: string;
              boxId: string;
            };
          };
        }) =>
          eventBoxes.find(
            (entry) =>
              entry.eventId === where.eventId_boxId.eventId && entry.boxId === where.eventId_boxId.boxId
          ) ?? null
      ),
      create: jest.fn(
        async ({
          data
        }: {
          data: {
            eventId: string;
            boxId: string;
          };
        }) => {
          const duplicate = eventBoxes.find(
            (entry) => entry.eventId === data.eventId && entry.boxId === data.boxId
          );
          if (duplicate) {
            const error = new Error('Unique constraint failed');
            (error as { code?: string }).code = 'P2002';
            throw error;
          }

          const row: EventBoxRecord = {
            eventId: data.eventId,
            boxId: data.boxId,
            createdAt: new Date()
          };
          eventBoxes.push(row);
          return { ...row };
        }
      ),
      delete: jest.fn(
        async ({
          where
        }: {
          where: {
            eventId_boxId: {
              eventId: string;
              boxId: string;
            };
          };
        }) => {
          const index = eventBoxes.findIndex(
            (entry) =>
              entry.eventId === where.eventId_boxId.eventId && entry.boxId === where.eventId_boxId.boxId
          );
          if (index < 0) {
            throw new Error('event box not found');
          }
          const [row] = eventBoxes.splice(index, 1);
          return row;
        }
      )
    },
    eventItemBox: {
      findFirst: jest.fn(
        async ({
          where,
          select
        }: {
          where: {
            eventItemId?: string;
            boxId?: string;
          };
          select?: Record<string, unknown>;
        }) => {
          const row =
            eventItemBoxes.find((entry) => {
              const eventItemMatch = where.eventItemId ? entry.eventItemId === where.eventItemId : true;
              const boxMatch = where.boxId ? entry.boxId === where.boxId : true;
              return eventItemMatch && boxMatch;
            }) ?? null;

          if (!row) {
            return null;
          }
          if (select) {
            return pickSelected(row as unknown as Record<string, unknown>, select);
          }
          return { ...row };
        }
      ),
      findMany: jest.fn(
        async ({
          where,
          include,
          orderBy,
          select
        }: {
          where?: {
            eventItemId?: string;
            boxId?: string;
            eventItem?: {
              eventId?: string;
            };
          };
          include?: {
            box?: {
              select?: {
                boxCode?: boolean;
              };
            };
          };
          orderBy?: Array<Record<string, unknown>>;
          select?: Record<string, unknown>;
        } = {}) => {
          let rows = [...eventItemBoxes];

          if (where?.eventItemId) {
            rows = rows.filter((entry) => entry.eventItemId === where.eventItemId);
          }
          if (where?.boxId) {
            rows = rows.filter((entry) => entry.boxId === where.boxId);
          }
          if (where?.eventItem?.eventId) {
            const ids = new Set(
              eventItems
                .filter((entry) => entry.eventId === where.eventItem!.eventId)
                .map((entry) => entry.id)
            );
            rows = rows.filter((entry) => ids.has(entry.eventItemId));
          }

          if (Array.isArray(orderBy) && orderBy.length > 0) {
            rows.sort((left, right) => {
              for (const sort of orderBy) {
                if ('createdAt' in sort) {
                  const direction = sort.createdAt as 'asc' | 'desc';
                  const delta = left.createdAt.getTime() - right.createdAt.getTime();
                  if (delta !== 0) {
                    return direction === 'asc' ? delta : -delta;
                  }
                }
                if ('box' in sort) {
                  const direction = (sort.box as { boxCode?: 'asc' | 'desc' }).boxCode;
                  const leftCode = boxes.find((entry) => entry.id === left.boxId)?.boxCode ?? '';
                  const rightCode = boxes.find((entry) => entry.id === right.boxId)?.boxCode ?? '';
                  const delta = leftCode.localeCompare(rightCode);
                  if (delta !== 0 && direction) {
                    return direction === 'asc' ? delta : -delta;
                  }
                }
              }
              return 0;
            });
          }

          if (select) {
            return rows.map((row) => pickSelected(row as unknown as Record<string, unknown>, select));
          }

          return rows.map((row) => {
            const base: Record<string, unknown> = { ...row };
            if (include?.box) {
              const box = boxes.find((entry) => entry.id === row.boxId) ?? null;
              base.box = box ? { boxCode: box.boxCode } : null;
            }
            return base;
          });
        }
      ),
      create: jest.fn(
        async ({
          data
        }: {
          data: {
            eventItemId: string;
            boxId: string;
          };
        }) => {
          const duplicate = eventItemBoxes.find(
            (entry) => entry.eventItemId === data.eventItemId && entry.boxId === data.boxId
          );
          if (duplicate) {
            const error = new Error('Unique constraint failed');
            (error as { code?: string }).code = 'P2002';
            throw error;
          }

          const row: EventItemBoxRecord = {
            eventItemId: data.eventItemId,
            boxId: data.boxId,
            createdAt: new Date(FIXED_LINKED_AT)
          };
          eventItemBoxes.push(row);
          return { ...row };
        }
      ),
      deleteMany: jest.fn(
        async ({
          where
        }: {
          where?: {
            boxId?: string;
            eventItem?: {
              eventId?: string;
            };
          };
        } = {}) => {
          const shouldDelete = (row: EventItemBoxRecord): boolean => {
            if (where?.boxId && row.boxId !== where.boxId) {
              return false;
            }
            if (where?.eventItem?.eventId) {
              const eventItem = eventItems.find((entry) => entry.id === row.eventItemId);
              if (!eventItem || eventItem.eventId !== where.eventItem.eventId) {
                return false;
              }
            }
            return true;
          };

          const before = eventItemBoxes.length;
          for (let index = eventItemBoxes.length - 1; index >= 0; index -= 1) {
            if (shouldDelete(eventItemBoxes[index])) {
              eventItemBoxes.splice(index, 1);
            }
          }
          return { count: before - eventItemBoxes.length };
        }
      )
    },
    stockAdjustment: {
      create: jest.fn(
        async ({
          data
        }: {
          data: {
            itemId: string;
            beforeQuantity: number;
            afterQuantity: number;
            delta: number;
          };
        }) => {
          const row: StockAdjustmentRecord = {
            id: `adj-${stockAdjustments.length + 1}`,
            itemId: data.itemId,
            beforeQuantity: data.beforeQuantity,
            afterQuantity: data.afterQuantity,
            delta: data.delta
          };
          stockAdjustments.push(row);
          return row;
        }
      )
    }
  } as const;

  const prismaWithTransaction = {
    ...prisma,
    $transaction: async <T>(
      fn: (tx: typeof prisma) => Promise<T>,
      _options?: unknown
    ): Promise<T> => fn(prisma)
  };

  return {
    prisma: prismaWithTransaction,
    events,
    eventItems,
    eventBoxes,
    eventItemBoxes,
    items,
    boxes,
    boxItems,
    stockAdjustments
  };
}
