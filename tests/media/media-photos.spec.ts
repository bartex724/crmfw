import { MediaService, type UploadedPhotoFile } from '../../src/media/media.service';

type ItemRecord = {
  id: string;
  name: string;
};

type PhotoRecord = {
  id: string;
  itemId: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
  isMain: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function createMediaHarness() {
  const items: ItemRecord[] = [{ id: 'item-1', name: 'Cable' }];
  const photos: PhotoRecord[] = [];

  const prisma = {
    item: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return items.find((item) => item.id === where.id) ?? null;
      })
    },
    itemPhoto: {
      findMany: jest.fn(
        async ({
          where
        }: {
          where: {
            itemId: string;
          };
          orderBy: {
            position: 'asc' | 'desc';
          };
        }) => {
          return photos
            .filter((photo) => photo.itemId === where.itemId)
            .sort((a, b) => a.position - b.position)
            .map((photo) => ({ ...photo }));
        }
      ),
      findFirst: jest.fn(
        async ({
          where,
          orderBy
        }: {
          where: {
            id?: string;
            itemId: string;
            isMain?: boolean;
          };
          orderBy?: {
            position: 'asc' | 'desc';
          };
        }) => {
          let filtered = photos.filter((photo) => photo.itemId === where.itemId);
          if (where.id) {
            filtered = filtered.filter((photo) => photo.id === where.id);
          }
          if (where.isMain !== undefined) {
            filtered = filtered.filter((photo) => photo.isMain === where.isMain);
          }
          if (orderBy?.position) {
            filtered.sort((a, b) => a.position - b.position);
          }
          return filtered.length > 0 ? { ...filtered[0] } : null;
        }
      ),
      updateMany: jest.fn(
        async ({
          where,
          data
        }: {
          where: {
            itemId: string;
            isMain?: boolean;
          };
          data: {
            isMain?: boolean;
          };
        }) => {
          let count = 0;
          for (const photo of photos) {
            if (photo.itemId !== where.itemId) {
              continue;
            }
            if (where.isMain !== undefined && photo.isMain !== where.isMain) {
              continue;
            }
            if (data.isMain !== undefined) {
              photo.isMain = data.isMain;
            }
            photo.updatedAt = new Date();
            count += 1;
          }
          return { count };
        }
      ),
      create: jest.fn(
        async ({
          data
        }: {
          data: {
            itemId: string;
            relativePath: string;
            mimeType: string;
            sizeBytes: number;
            position: number;
            isMain: boolean;
          };
        }) => {
          const now = new Date();
          const record: PhotoRecord = {
            id: `photo-${photos.length + 1}`,
            itemId: data.itemId,
            relativePath: data.relativePath,
            mimeType: data.mimeType,
            sizeBytes: data.sizeBytes,
            position: data.position,
            isMain: data.isMain,
            createdAt: now,
            updatedAt: now
          };
          photos.push(record);
          return { ...record };
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
            isMain?: boolean;
            position?: number;
          };
        }) => {
          const target = photos.find((photo) => photo.id === where.id);
          if (!target) {
            throw new Error('not found');
          }
          if (data.isMain !== undefined) {
            target.isMain = data.isMain;
          }
          if (data.position !== undefined) {
            target.position = data.position;
          }
          target.updatedAt = new Date();
          return { ...target };
        }
      ),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const index = photos.findIndex((photo) => photo.id === where.id);
        if (index < 0) {
          throw new Error('not found');
        }
        const [deleted] = photos.splice(index, 1);
        return deleted;
      })
    }
  } as const;

  const prismaWithTransaction = {
    ...prisma,
    $transaction: async <T>(fn: (tx: typeof prisma) => Promise<T>): Promise<T> => fn(prisma)
  };

  return {
    prisma: prismaWithTransaction,
    photos
  };
}

function buildImageFile(
  filename: string,
  sizeBytes: number,
  mimetype = 'image/jpeg'
): UploadedPhotoFile {
  return {
    originalname: filename,
    mimetype,
    size: sizeBytes,
    buffer: Buffer.alloc(sizeBytes > 0 ? 1 : 0, 'a')
  };
}

describe('Media photo lifecycle', () => {
  it('validates file constraints (15 * 1024 * 1024) and uploads photo metadata', async () => {
    const harness = createMediaHarness();
    const storageService = {
      writeBuffer: jest.fn(async () => 'C:\\tmp\\photo.jpg'),
      removeFile: jest.fn(async () => undefined)
    };
    const auditService = { record: jest.fn(async () => undefined) };
    const service = new MediaService(
      harness.prisma as never,
      storageService as never,
      auditService as never
    );

    const uploaded = await service.uploadPhoto(
      'item-1',
      buildImageFile('main.jpg', 1024, 'image/jpeg'),
      { isMain: false },
      'admin-1'
    );
    expect(uploaded.isMain).toBe(true);

    await service.uploadPhoto(
      'item-1',
      buildImageFile('gallery.webp', 2048, 'image/webp'),
      { isMain: false },
      'admin-1'
    );

    await expect(
      service.uploadPhoto(
        'item-1',
        buildImageFile('too-large.jpg', 15 * 1024 * 1024 + 1, 'image/jpeg'),
        { isMain: false },
        'admin-1'
      )
    ).rejects.toThrow('15 MB');

    await expect(
      service.uploadPhoto(
        'item-1',
        buildImageFile('document.pdf', 100, 'application/pdf'),
        { isMain: false },
        'admin-1'
      )
    ).rejects.toThrow('browser-supported image formats');
  });

  it('supports manual reorder and auto-promote when deleting main photo', async () => {
    const harness = createMediaHarness();
    const storageService = {
      writeBuffer: jest.fn(async () => 'C:\\tmp\\photo.jpg'),
      removeFile: jest.fn(async () => undefined)
    };
    const auditService = { record: jest.fn(async () => undefined) };
    const service = new MediaService(
      harness.prisma as never,
      storageService as never,
      auditService as never
    );

    const first = await service.uploadPhoto(
      'item-1',
      buildImageFile('first.jpg', 1200),
      { isMain: false },
      'admin-1'
    );
    const second = await service.uploadPhoto(
      'item-1',
      buildImageFile('second.jpg', 1300),
      { isMain: false },
      'admin-1'
    );

    const mainChanged = await service.setMainPhoto('item-1', String(second.id), 'admin-1');
    expect(mainChanged.isMain).toBe(true);

    const reordered = await service.reorderPhotos(
      'item-1',
      { photoIds: [String(second.id), String(first.id)] },
      'admin-1'
    );
    expect(reordered[0].id).toBe(String(second.id));
    expect(reordered[0].position).toBe(1);

    await service.deletePhoto('item-1', String(second.id), 'admin-1');
    const afterDelete = await service.listPhotos('item-1');
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0].id).toBe(String(first.id));
    expect(afterDelete[0].isMain).toBe(true);

    await service.deletePhoto('item-1', String(first.id), 'admin-1');
    const empty = await service.listPhotos('item-1');
    expect(empty).toEqual([]);
  });
});
