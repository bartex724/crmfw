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
  relativePath: string;
  isMain: boolean;
  position: number;
};

function createListHarness() {
  const categories: CategoryRecord[] = [];
  const items: ItemRecord[] = [];
  const itemPhotos: ItemPhotoRecord[] = [];

  const getCategory = (categoryId: string) =>
    categories.find((entry) => entry.id === categoryId) ?? null;

  const prisma = {
    category: {
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
          orderBy,
          select
        }: {
          where?: {
            categoryId?: string;
            OR?: Array<{
              name?: {
                contains: string;
                mode?: 'insensitive';
              };
              code?: {
                contains: string;
                mode?: 'insensitive';
              };
            }>;
            quantity?: {
              gt: number;
            };
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
          orderBy?: {
            name?: 'asc' | 'desc';
            code?: 'asc' | 'desc';
            quantity?: 'asc' | 'desc';
            updatedAt?: 'asc' | 'desc';
          };
          select?: {
            code?: boolean;
          };
        } = {}) => {
          if (select?.code) {
            return items.map((item) => ({ code: item.code }));
          }

          let filtered = [...items];

          if (where?.id?.in) {
            filtered = filtered.filter((item) => where.id?.in.includes(item.id));
          }
          if (where?.categoryId) {
            filtered = filtered.filter((item) => item.categoryId === where.categoryId);
          }
          if (where?.quantity?.gt !== undefined) {
            filtered = filtered.filter((item) => item.quantity > where.quantity!.gt);
          }
          if (where?.OR && where.OR.length > 0) {
            filtered = filtered.filter((item) =>
              where.OR!.some((condition) => {
                const nameSearch = condition.name?.contains?.toLowerCase();
                const codeSearch = condition.code?.contains?.toLowerCase();
                if (nameSearch && item.name.toLowerCase().includes(nameSearch)) {
                  return true;
                }
                if (codeSearch && item.code.toLowerCase().includes(codeSearch)) {
                  return true;
                }
                return false;
              })
            );
          }

          const orderByField = orderBy
            ? (Object.keys(orderBy)[0] as 'name' | 'code' | 'quantity' | 'updatedAt')
            : 'name';
          const orderDirection = orderBy ? (orderBy[orderByField] ?? 'asc') : 'asc';

          filtered.sort((left, right) => {
            const leftValue = left[orderByField];
            const rightValue = right[orderByField];
            if (leftValue === rightValue) {
              return 0;
            }
            if (leftValue > rightValue) {
              return orderDirection === 'asc' ? 1 : -1;
            }
            return orderDirection === 'asc' ? -1 : 1;
          });

          return filtered.map((item) => ({
            ...item,
            category: include?.category ? getCategory(item.categoryId) : undefined,
            photos: include?.photos
              ? itemPhotos
                  .filter((photo) => photo.itemId === item.id)
                  .sort((a, b) => a.position - b.position)
              : undefined
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
      )
    },
    itemPhoto: {
      count: jest.fn(async () => 0)
    },
    stockAdjustment: {
      count: jest.fn(async () => 0)
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
    itemPhotos
  };
}

describe('Inventory list behavior', () => {
  it('supports hideUnavailable sorting and includes allowedActions metadata', async () => {
    const harness = createListHarness();
    const auditService = { record: jest.fn(async () => undefined) };
    const service = new InventoryService(harness.prisma as never, auditService as never);

    const audio = await service.createCategory({ name: 'Audio' }, 'admin-1');
    const video = await service.createCategory({ name: 'Video' }, 'admin-1');

    const cable = await service.createItem(
      {
        name: 'Cable',
        categoryId: String(audio.id),
        quantity: 5
      },
      'admin-1'
    );
    await service.createItem(
      {
        name: 'Adapter',
        categoryId: String(audio.id),
        quantity: 0
      },
      'admin-1'
    );
    await service.createItem(
      {
        name: 'Camera',
        categoryId: String(video.id),
        quantity: 2,
        code: 'cam-01'
      },
      'admin-1'
    );

    harness.itemPhotos.push({
      id: 'photo-1',
      itemId: String(cable.id),
      relativePath: 'items/cable/main.jpg',
      isMain: true,
      position: 1
    });

    const hiddenUnavailable = await service.listItems({
      hideUnavailable: true,
      sortBy: 'quantity',
      sortOrder: 'desc',
      layout: 'cards'
    });

    expect(hiddenUnavailable).toHaveLength(2);
    expect(hiddenUnavailable[0].quantity).toBe(5);
    expect(hiddenUnavailable[1].quantity).toBe(2);
    expect(hiddenUnavailable.every((entry) => entry.layout === 'cards')).toBe(true);
    expect(hiddenUnavailable[0].allowedActions).toEqual(['edit', 'adjustStock', 'photos', 'delete']);
    expect(hiddenUnavailable[0].mainPhoto).toEqual({
      id: 'photo-1',
      relativePath: 'items/cable/main.jpg'
    });
  });

  it('supports category filter and search query combinations', async () => {
    const harness = createListHarness();
    const auditService = { record: jest.fn(async () => undefined) };
    const service = new InventoryService(harness.prisma as never, auditService as never);

    const audio = await service.createCategory({ name: 'Audio' }, 'admin-1');
    const video = await service.createCategory({ name: 'Video' }, 'admin-1');

    await service.createItem(
      {
        name: 'Cable',
        categoryId: String(audio.id),
        quantity: 4
      },
      'admin-1'
    );
    await service.createItem(
      {
        name: 'Camera',
        categoryId: String(video.id),
        quantity: 3
      },
      'admin-1'
    );

    const filtered = await service.listItems({
      categoryId: String(audio.id),
      search: 'cab',
      sortBy: 'name',
      sortOrder: 'asc',
      hideUnavailable: false
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Cable');
    expect(filtered[0].categoryId).toBe(String(audio.id));
    expect(filtered[0].isUnavailable).toBe(false);
  });
});
