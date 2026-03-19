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

type ItemPhotoRecord = {
  id: string;
  itemId: string;
};

type StockAdjustmentRecord = {
  id: string;
  itemId: string;
};

function createInventoryHarness() {
  const categories: CategoryRecord[] = [];
  const items: ItemRecord[] = [];
  const itemPhotos: ItemPhotoRecord[] = [];
  const stockAdjustments: StockAdjustmentRecord[] = [];

  const resolveCategory = (item: ItemRecord) =>
    categories.find((entry) => entry.id === item.categoryId) ?? null;

  const prisma = {
    category: {
      findMany: jest.fn(async () =>
        [...categories]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((category) => ({
            ...category,
            _count: {
              items: items.filter((item) => item.categoryId === category.id).length
            }
          }))
      ),
      findFirst: jest.fn(
        async ({
          where
        }: {
          where: {
            id?: {
              not: string;
            };
            name?: {
              equals: string;
              mode?: 'insensitive';
            };
          };
        }) => {
          const targetName = where.name?.equals;
          if (!targetName) {
            return null;
          }

          const excludedId = where.id?.not;
          return (
            categories.find((category) => {
              if (excludedId && category.id === excludedId) {
                return false;
              }
              return category.name.toLowerCase() === targetName.toLowerCase();
            }) ?? null
          );
        }
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return categories.find((category) => category.id === where.id) ?? null;
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
          const category: CategoryRecord = {
            id: `cat-${categories.length + 1}`,
            name: data.name,
            description: data.description,
            createdAt: now,
            updatedAt: now
          };
          categories.push(category);

          return {
            ...category,
            _count: {
              items: 0
            }
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
            name?: string;
            description?: string | null;
          };
        }) => {
          const category = categories.find((entry) => entry.id === where.id);
          if (!category) {
            throw new Error('not found');
          }

          if (data.name !== undefined) {
            category.name = data.name;
          }
          if (data.description !== undefined) {
            category.description = data.description;
          }
          category.updatedAt = new Date();

          return {
            ...category,
            _count: {
              items: items.filter((item) => item.categoryId === category.id).length
            }
          };
        }
      ),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const index = categories.findIndex((entry) => entry.id === where.id);
        if (index < 0) {
          throw new Error('not found');
        }
        const [deleted] = categories.splice(index, 1);
        return deleted;
      })
    },
    item: {
      count: jest.fn(async ({ where }: { where: { categoryId: string } }) => {
        return items.filter((item) => item.categoryId === where.categoryId).length;
      }),
      findMany: jest.fn(
        async ({
          select,
          include
        }: {
          select?: {
            code?: boolean;
          };
          include?: {
            category?: boolean;
          };
        } = {}) => {
          if (select?.code) {
            return items.map((item) => ({ code: item.code }));
          }

          return [...items]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((item) => ({
              ...item,
              category: include?.category ? resolveCategory(item) : undefined
            }));
        }
      ),
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
          const excludedId = where.id?.not;
          return (
            items.find((item) => item.code === where.code && item.id !== excludedId) ?? null
          );
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
            category?: boolean;
          };
        }) => {
          const item = items.find((entry) => entry.id === where.id);
          if (!item) {
            return null;
          }

          return {
            ...item,
            category: include?.category ? resolveCategory(item) : undefined
          };
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
          };
        }) => {
          const now = new Date();
          const item: ItemRecord = {
            id: `item-${items.length + 1}`,
            name: data.name,
            code: data.code,
            quantity: data.quantity,
            notes: data.notes,
            categoryId: data.categoryId,
            createdAt: now,
            updatedAt: now
          };
          items.push(item);

          return {
            ...item,
            category: include?.category ? resolveCategory(item) : undefined
          };
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
            notes?: string | null;
            code?: string;
            category?: {
              connect: {
                id: string;
              };
            };
          };
          include?: {
            category?: boolean;
          };
        }) => {
          const item = items.find((entry) => entry.id === where.id);
          if (!item) {
            throw new Error('not found');
          }

          if (data.name !== undefined) {
            item.name = data.name;
          }
          if (data.notes !== undefined) {
            item.notes = data.notes;
          }
          if (data.code !== undefined) {
            item.code = data.code;
          }
          if (data.category?.connect.id) {
            item.categoryId = data.category.connect.id;
          }
          item.updatedAt = new Date();

          return {
            ...item,
            category: include?.category ? resolveCategory(item) : undefined
          };
        }
      ),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const index = items.findIndex((entry) => entry.id === where.id);
        if (index < 0) {
          throw new Error('not found');
        }
        const [deleted] = items.splice(index, 1);
        for (let i = itemPhotos.length - 1; i >= 0; i -= 1) {
          if (itemPhotos[i].itemId === deleted.id) {
            itemPhotos.splice(i, 1);
          }
        }
        for (let i = stockAdjustments.length - 1; i >= 0; i -= 1) {
          if (stockAdjustments[i].itemId === deleted.id) {
            stockAdjustments.splice(i, 1);
          }
        }
        return deleted;
      }),
      deleteMany: jest.fn(async ({ where }: { where: { categoryId: string } }) => {
        const targetIds = items
          .filter((item) => item.categoryId === where.categoryId)
          .map((item) => item.id);

        for (const id of targetIds) {
          const index = items.findIndex((item) => item.id === id);
          if (index >= 0) {
            items.splice(index, 1);
          }
        }

        for (let i = itemPhotos.length - 1; i >= 0; i -= 1) {
          if (targetIds.includes(itemPhotos[i].itemId)) {
            itemPhotos.splice(i, 1);
          }
        }
        for (let i = stockAdjustments.length - 1; i >= 0; i -= 1) {
          if (targetIds.includes(stockAdjustments[i].itemId)) {
            stockAdjustments.splice(i, 1);
          }
        }

        return {
          count: targetIds.length
        };
      })
    },
    itemPhoto: {
      count: jest.fn(async ({ where }: { where: { itemId: string } }) => {
        return itemPhotos.filter((photo) => photo.itemId === where.itemId).length;
      })
    },
    stockAdjustment: {
      count: jest.fn(async ({ where }: { where: { itemId: string } }) => {
        return stockAdjustments.filter((adjustment) => adjustment.itemId === where.itemId).length;
      })
    }
  } as const;

  const prismaWithTransaction = {
    ...prisma,
    $transaction: async <T>(fn: (tx: typeof prisma) => Promise<T>): Promise<T> => fn(prisma)
  };

  return {
    prisma: prismaWithTransaction,
    categories,
    items,
    itemPhotos,
    stockAdjustments
  };
}

describe('Inventory item/category CRUD', () => {
  it('creates categories/items and keeps quantity as central stock value', async () => {
    const harness = createInventoryHarness();
    const auditService = { record: jest.fn(async () => undefined) };
    const service = new InventoryService(harness.prisma as never, auditService as never);

    const category = await service.createCategory(
      {
        name: 'Audio',
        description: 'Speakers and cables'
      },
      'admin-1'
    );

    const firstItem = await service.createItem(
      {
        name: 'Cable',
        categoryId: String(category.id),
        quantity: 5
      },
      'admin-1'
    );
    const secondItem = await service.createItem(
      {
        name: 'Cable',
        categoryId: String(category.id),
        quantity: 0
      },
      'admin-1'
    );

    expect(firstItem.code).toBe('ITM-0001');
    expect(secondItem.code).toBe('ITM-0002');
    expect(firstItem.quantity).toBe(5);
    expect(firstItem.isUnavailable).toBe(false);
    expect(secondItem.isUnavailable).toBe(true);

    const updatedItem = await service.updateItem(
      String(firstItem.id),
      {
        code: 'itm-custom',
        notes: 'Main stage'
      },
      'admin-1'
    );

    expect(updatedItem.code).toBe('ITM-CUSTOM');
    expect(updatedItem.notes).toBe('Main stage');

    const listed = await service.listItems();
    expect(listed).toHaveLength(2);
    expect(listed.some((item) => item.code === 'ITM-CUSTOM')).toBe(true);
  });

  it('rejects Duplicate item code on create and update', async () => {
    const harness = createInventoryHarness();
    const auditService = { record: jest.fn(async () => undefined) };
    const service = new InventoryService(harness.prisma as never, auditService as never);

    const category = await service.createCategory({ name: 'Video' }, 'admin-1');

    await service.createItem(
      {
        name: 'Projector',
        categoryId: String(category.id),
        code: 'dup-1',
        quantity: 1
      },
      'admin-1'
    );

    await expect(
      service.createItem(
        {
          name: 'Projector Backup',
          categoryId: String(category.id),
          code: 'dup-1',
          quantity: 1
        },
        'admin-1'
      )
    ).rejects.toThrow('Duplicate item code');

    const secondary = await service.createItem(
      {
        name: 'Projector Stand',
        categoryId: String(category.id),
        code: 'dup-2',
        quantity: 1
      },
      'admin-1'
    );

    await expect(
      service.updateItem(
        String(secondary.id),
        {
          code: 'DUP-1'
        },
        'admin-1'
      )
    ).rejects.toThrow('Duplicate item code');
  });

  it('requires force=true when deleting dependent items or categories', async () => {
    const harness = createInventoryHarness();
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

    harness.itemPhotos.push({
      id: 'photo-1',
      itemId: String(item.id)
    });
    harness.stockAdjustments.push({
      id: 'adjustment-1',
      itemId: String(item.id)
    });

    await expect(service.deleteItem(String(item.id), false, 'admin-1')).rejects.toThrow(
      'force=true'
    );

    await expect(service.deleteItem(String(item.id), true, 'admin-1')).resolves.toEqual({
      deleted: true,
      id: String(item.id),
      force: true
    });

    const dependentItem = await service.createItem(
      {
        name: 'Desk Light',
        categoryId: String(category.id),
        quantity: 1
      },
      'admin-1'
    );
    expect(dependentItem.code).toBe('ITM-0001');

    await expect(service.deleteCategory(String(category.id), false, 'admin-1')).rejects.toThrow(
      'force=true'
    );

    await expect(service.deleteCategory(String(category.id), true, 'admin-1')).resolves.toEqual({
      deleted: true,
      id: String(category.id),
      force: true
    });

    expect(harness.items).toHaveLength(0);
    expect(harness.categories).toHaveLength(0);
  });
});
