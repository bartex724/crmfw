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

type EventItemRecord = {
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
};

type StockAdjustmentRecord = {
  id: string;
  itemId: string;
  actorUserId: string | null;
  reason: string;
  beforeQuantity: number;
  afterQuantity: number;
  delta: number;
};

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
    .map((entry) => eventItemWithOptionalItem(entry, items, includeItem));

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

export function createEventsHarness() {
  const events: EventRecord[] = [];
  const eventItems: EventItemRecord[] = [];
  const stockAdjustments: StockAdjustmentRecord[] = [];

  const items: ItemRecord[] = [
    { id: 'item-1', name: 'Cable', code: 'ITM-0001', quantity: 10 },
    { id: 'item-2', name: 'Speaker', code: 'ITM-0002', quantity: 5 },
    { id: 'item-3', name: 'Lamp', code: 'ITM-0003', quantity: 4 },
    { id: 'item-4', name: 'Cable', code: 'ITM-0000', quantity: 7 }
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
          include
        }: {
          where: {
            id?: string;
            eventId?: string;
            itemId?: string;
          };
          include?: {
            item?: unknown;
          };
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

          return eventItemWithOptionalItem(row, items, Boolean(include?.item));
        }
      ),
      findMany: jest.fn(
        async ({
          where,
          include
        }: {
          where?: {
            eventId?: string;
            id?: {
              in: string[];
            };
          };
          include?: {
            item?: unknown;
          };
        } = {}) => {
          let selected = [...eventItems];
          if (where?.eventId) {
            selected = selected.filter((entry) => entry.eventId === where.eventId);
          }
          if (where?.id?.in) {
            selected = selected.filter((entry) => where.id!.in.includes(entry.id));
          }
          return selected.map((entry) => eventItemWithOptionalItem(entry, items, Boolean(include?.item)));
        }
      ),
      create: jest.fn(
        async ({
          data,
          include
        }: {
          data: {
            eventId: string;
            itemId: string;
            plannedQuantity: number;
            status: EventItemStatus;
            lostQuantity?: number;
            returnedQuantity?: number;
          };
          include?: {
            item?: unknown;
          };
        }) => {
          const now = new Date();
          const row: EventItemRecord = {
            id: `evt-item-${eventItems.length + 1}`,
            eventId: data.eventId,
            itemId: data.itemId,
            plannedQuantity: data.plannedQuantity,
            lostQuantity: data.lostQuantity ?? 0,
            returnedQuantity: data.returnedQuantity ?? 0,
            status: data.status,
            boxCode: null,
            createdAt: now,
            updatedAt: now
          };
          eventItems.push(row);
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
            lostQuantity?: number;
            returnedQuantity?: number;
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
          if (data.lostQuantity !== undefined) {
            row.lostQuantity = data.lostQuantity;
          }
          if (data.returnedQuantity !== undefined) {
            row.returnedQuantity = data.returnedQuantity;
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
    stockAdjustment: {
      create: jest.fn(
        async ({
          data
        }: {
          data: {
            itemId: string;
            actorUserId?: string | null;
            reason?: string;
            beforeQuantity: number;
            afterQuantity: number;
            delta: number;
          };
        }) => {
          const row: StockAdjustmentRecord = {
            id: `adj-${stockAdjustments.length + 1}`,
            itemId: data.itemId,
            actorUserId: data.actorUserId ?? null,
            reason: data.reason ?? 'adjustment',
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
    $transaction: async <T>(fn: (tx: typeof prisma) => Promise<T>): Promise<T> => fn(prisma)
  };

  return {
    prisma: prismaWithTransaction,
    events,
    eventItems,
    items,
    stockAdjustments
  };
}
