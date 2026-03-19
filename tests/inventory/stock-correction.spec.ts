import { InventoryService } from '../../src/inventory/inventory.service';

type CategoryRecord = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ItemRecord = {
  id: string;
  name: string;
  code: string;
  quantity: number;
  notes: string | null;
  categoryId: string;
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

function createStockHarness() {
  const categories: CategoryRecord[] = [];
  const items: ItemRecord[] = [];
  const stockAdjustments: StockAdjustmentRecord[] = [];

  const getCategory = (categoryId: string) =>
    categories.find((entry) => entry.id === categoryId) ?? null;

  const prisma = {
    category: {
      findFirst: jest.fn(
        async ({
          where
        }: {
          where: {
            name?: {
              equals: string;
            };
            id?: {
              not: string;
            };
          };
        }) => {
          const name = where.name?.equals;
          if (!name) {
            return null;
          }
          const excluded = where.id?.not;
          return (
            categories.find(
              (entry) => entry.id !== excluded && entry.name.toLowerCase() === name.toLowerCase()
            ) ?? null
          );
        }
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return categories.find((entry) => entry.id === where.id) ?? null;
      }),
      create: jest.fn(
        async ({
          data
        }: {
          data: {
            name: string;
            description: string | null;
          };
        }) => {
          const now = new Date();
          const record: CategoryRecord = {
            id: `cat-${categories.length + 1}`,
            name: data.name,
            description: data.description,
            createdAt: now,
            updatedAt: now
          };
          categories.push(record);
          return {
            ...record,
            _count: {
              items: items.filter((item) => item.categoryId === record.id).length
            }
          };
        }
      )
    },
    item: {
      findFirst: jest.fn(
        async ({
          where
        }: {
          where: {
            code: string;
            id?: {
              not: string;
            };
          };
        }) => {
          const excluded = where.id?.not;
          return items.find((entry) => entry.code === where.code && entry.id !== excluded) ?? null;
        }
      ),
      findMany: jest.fn(
        async ({
          where,
          include,
          select
        }: {
          where?: {
            id?: {
              in: string[];
            };
          };
          include?: {
            category?: boolean;
            photos?: {
              select: {
                id: boolean;
                relativePath: boolean;
                isMain: boolean;
                position: boolean;
              };
              orderBy: {
                position: 'asc' | 'desc';
              };
            };
          };
          select?: {
            code?: boolean;
          };
        } = {}) => {
          if (select?.code) {
            return items.map((item) => ({ code: item.code }));
          }

          let selected = [...items];
          if (where?.id?.in) {
            selected = selected.filter((item) => where.id!.in.includes(item.id));
          }

          return selected.map((item) => ({
            ...item,
            category: include?.category ? getCategory(item.categoryId) : undefined,
            photos: include?.photos ? [] : undefined
          }));
        }
      ),
      create: jest.fn(
        async ({
          data,
          include
        }: {
          data: {
            name: string;
            code: string;
            quantity: number;
            notes: string | null;
            categoryId: string;
          };
          include?: {
            category?: boolean;
            photos?: {
              select: {
                id: boolean;
                relativePath: boolean;
                isMain: boolean;
                position: boolean;
              };
              orderBy: {
                position: 'asc' | 'desc';
              };
            };
          };
        }) => {
          const now = new Date();
          const record: ItemRecord = {
            id: `item-${items.length + 1}`,
            name: data.name,
            code: data.code,
            quantity: data.quantity,
            notes: data.notes,
            categoryId: data.categoryId,
            createdAt: now,
            updatedAt: now
          };
          items.push(record);

          return {
            ...record,
            category: include?.category ? getCategory(record.categoryId) : undefined,
            photos: include?.photos ? [] : undefined
          };
        }
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
            throw new Error('not found');
          }

          if (data.quantity !== undefined) {
            item.quantity = data.quantity;
          }
          item.updatedAt = new Date();
          return { ...item };
        }
      )
    },
    stockAdjustment: {
      count: jest.fn(async ({ where }: { where: { itemId: string } }) => {
        return stockAdjustments.filter((entry) => entry.itemId === where.itemId).length;
      }),
      create: jest.fn(
        async ({
          data
        }: {
          data: {
            itemId: string;
            actorUserId: string | null;
            reason: string;
            beforeQuantity: number;
            afterQuantity: number;
            delta: number;
          };
        }) => {
          const record: StockAdjustmentRecord = {
            id: `adj-${stockAdjustments.length + 1}`,
            itemId: data.itemId,
            actorUserId: data.actorUserId,
            reason: data.reason,
            beforeQuantity: data.beforeQuantity,
            afterQuantity: data.afterQuantity,
            delta: data.delta
          };
          stockAdjustments.push(record);
          return record;
        }
      )
    },
    itemPhoto: {
      count: jest.fn(async () => 0)
    }
  } as const;

  const prismaWithTransaction = {
    ...prisma,
    $transaction: async <T>(fn: (tx: typeof prisma) => Promise<T>): Promise<T> => fn(prisma)
  };

  return {
    prisma: prismaWithTransaction,
    items,
    stockAdjustments
  };
}

describe('Inventory stock correction flows', () => {
  it('supports stock/preview and stock/apply with inventory.stock.adjusted audit action', async () => {
    const harness = createStockHarness();
    const auditService = { record: jest.fn(async () => undefined) };
    const service = new InventoryService(harness.prisma as never, auditService as never);

    const category = await service.createCategory({ name: 'Audio' }, 'admin-1');
    const item = await service.createItem(
      {
        name: 'Cable',
        categoryId: String(category.id),
        quantity: 5
      },
      'admin-1'
    );

    const previewRows = await service.previewStockAdjustments({
      adjustments: [
        {
          itemId: String(item.id),
          quantity: 2,
          reason: 'Damaged in transport'
        }
      ]
    });

    expect(previewRows).toEqual([
      {
        itemId: String(item.id),
        itemName: 'Cable',
        itemCode: 'ITM-0001',
        beforeQuantity: 5,
        afterQuantity: 2,
        delta: -3,
        reason: 'Damaged in transport'
      }
    ]);

    const appliedRows = await service.applyStockAdjustments(
      {
        adjustments: [
          {
            itemId: String(item.id),
            quantity: 2,
            reason: 'Damaged in transport'
          }
        ]
      },
      'admin-1'
    );

    expect(appliedRows[0].afterQuantity).toBe(2);
    expect(harness.items[0].quantity).toBe(2);
    expect(harness.stockAdjustments).toHaveLength(1);
    expect(harness.stockAdjustments[0]).toMatchObject({
      itemId: String(item.id),
      beforeQuantity: 5,
      afterQuantity: 2,
      delta: -3
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'inventory.stock.adjusted'
      })
    );
  });

  it('rejects duplicate payload entries, unknown items, and negative quantities', async () => {
    const harness = createStockHarness();
    const auditService = { record: jest.fn(async () => undefined) };
    const service = new InventoryService(harness.prisma as never, auditService as never);

    const category = await service.createCategory({ name: 'Lighting' }, 'admin-1');
    const item = await service.createItem(
      {
        name: 'Spotlight',
        categoryId: String(category.id),
        quantity: 3
      },
      'admin-1'
    );

    await expect(
      service.previewStockAdjustments({
        adjustments: [
          {
            itemId: String(item.id),
            quantity: 1,
            reason: 'Correction A'
          },
          {
            itemId: String(item.id),
            quantity: 2,
            reason: 'Correction B'
          }
        ]
      })
    ).rejects.toThrow('Duplicate item in stock adjustment payload');

    await expect(
      service.previewStockAdjustments({
        adjustments: [
          {
            itemId: 'missing-item',
            quantity: 1,
            reason: 'Missing'
          }
        ]
      })
    ).rejects.toThrow('Item not found');

    await expect(
      service.applyStockAdjustments(
        {
          adjustments: [
            {
              itemId: String(item.id),
              quantity: -1,
              reason: 'Invalid negative'
            }
          ]
        },
        'admin-1'
      )
    ).rejects.toThrow('Quantity cannot be negative');
  });
});
