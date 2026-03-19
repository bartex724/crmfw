import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ReorderPhotosDto } from './dto/reorder-photos.dto';
import { UploadPhotosDto } from './dto/upload-photos.dto';

export type UploadedPhotoFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type ItemPhotoRecord = {
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

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService
  ) {}

  async listPhotos(itemId: string): Promise<Array<Record<string, unknown>>> {
    await this.ensureItemExists(itemId);

    const photos = await this.prisma.itemPhoto.findMany({
      where: { itemId },
      orderBy: { position: 'asc' }
    });

    return photos.map((photo) => this.toPhotoResponse(photo));
  }

  async uploadPhoto(
    itemId: string,
    file: UploadedPhotoFile | undefined,
    dto: UploadPhotosDto,
    actorUserId: string | null
  ): Promise<Record<string, unknown>> {
    await this.ensureItemExists(itemId);
    this.assertUploadFile(file);

    const extension = this.resolveFileExtension(file.originalname, file.mimetype);
    const relativePath = path.posix.join('items', itemId, `${randomUUID()}${extension}`);

    await this.storageService.writeBuffer(relativePath, file.buffer);

    const existingPhotos = await this.prisma.itemPhoto.findMany({
      where: { itemId },
      orderBy: { position: 'asc' }
    });

    const nextPosition = existingPhotos.length > 0 ? existingPhotos[existingPhotos.length - 1].position + 1 : 1;
    const shouldBeMain = existingPhotos.length === 0 || dto.isMain === true;

    const createdPhoto = await this.prisma.$transaction(async (tx) => {
      if (shouldBeMain) {
        await tx.itemPhoto.updateMany({
          where: {
            itemId,
            isMain: true
          },
          data: {
            isMain: false
          }
        });
      }

      return tx.itemPhoto.create({
        data: {
          itemId,
          relativePath,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          position: nextPosition,
          isMain: shouldBeMain
        }
      });
    });

    await this.auditService.record({
      action: 'inventory.photo.uploaded',
      entityType: 'item_photo',
      entityId: createdPhoto.id,
      actorUserId,
      metadata: {
        itemId,
        relativePath,
        sizeBytes: createdPhoto.sizeBytes,
        isMain: createdPhoto.isMain
      }
    });

    return this.toPhotoResponse(createdPhoto);
  }

  async setMainPhoto(
    itemId: string,
    photoId: string,
    actorUserId: string | null
  ): Promise<Record<string, unknown>> {
    await this.ensureItemExists(itemId);

    const photo = await this.prisma.itemPhoto.findFirst({
      where: {
        id: photoId,
        itemId
      }
    });
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    const updatedPhoto = await this.prisma.$transaction(async (tx) => {
      await tx.itemPhoto.updateMany({
        where: {
          itemId,
          isMain: true
        },
        data: {
          isMain: false
        }
      });

      return tx.itemPhoto.update({
        where: {
          id: photoId
        },
        data: {
          isMain: true
        }
      });
    });

    await this.auditService.record({
      action: 'inventory.photo.main.changed',
      entityType: 'item_photo',
      entityId: updatedPhoto.id,
      actorUserId,
      metadata: {
        itemId
      }
    });

    return this.toPhotoResponse(updatedPhoto);
  }

  async reorderPhotos(
    itemId: string,
    dto: ReorderPhotosDto,
    actorUserId: string | null
  ): Promise<Array<Record<string, unknown>>> {
    await this.ensureItemExists(itemId);

    const existing = await this.prisma.itemPhoto.findMany({
      where: { itemId },
      orderBy: { position: 'asc' }
    });

    const existingIds = new Set(existing.map((photo) => photo.id));
    if (existing.length !== dto.photoIds.length) {
      throw new BadRequestException('Reorder payload must include all photo IDs');
    }
    for (const photoId of dto.photoIds) {
      if (!existingIds.has(photoId)) {
        throw new BadRequestException(`Unknown photo ID: ${photoId}`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (let index = 0; index < dto.photoIds.length; index += 1) {
        await tx.itemPhoto.update({
          where: {
            id: dto.photoIds[index]
          },
          data: {
            position: index + 1
          }
        });
      }
    });

    await this.auditService.record({
      action: 'inventory.photo.reordered',
      entityType: 'item',
      entityId: itemId,
      actorUserId,
      metadata: {
        photoIds: dto.photoIds
      }
    });

    const photos = await this.prisma.itemPhoto.findMany({
      where: { itemId },
      orderBy: { position: 'asc' }
    });

    return photos.map((photo) => this.toPhotoResponse(photo));
  }

  async deletePhoto(
    itemId: string,
    photoId: string,
    actorUserId: string | null
  ): Promise<{ deleted: true; id: string }> {
    await this.ensureItemExists(itemId);

    const targetPhoto = await this.prisma.itemPhoto.findFirst({
      where: {
        id: photoId,
        itemId
      }
    });
    if (!targetPhoto) {
      throw new NotFoundException('Photo not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.itemPhoto.delete({
        where: {
          id: photoId
        }
      });

      const stillHasMain = await tx.itemPhoto.findFirst({
        where: {
          itemId,
          isMain: true
        }
      });

      if (!stillHasMain) {
        const firstPhoto = await tx.itemPhoto.findFirst({
          where: {
            itemId
          },
          orderBy: {
            position: 'asc'
          }
        });

        if (firstPhoto) {
          await tx.itemPhoto.update({
            where: {
              id: firstPhoto.id
            },
            data: {
              isMain: true
            }
          });
        }
      }
    });

    await this.storageService.removeFile(targetPhoto.relativePath);

    await this.auditService.record({
      action: 'inventory.photo.deleted',
      entityType: 'item_photo',
      entityId: photoId,
      actorUserId,
      metadata: {
        itemId,
        relativePath: targetPhoto.relativePath
      }
    });

    return {
      deleted: true,
      id: photoId
    };
  }

  private async ensureItemExists(itemId: string): Promise<void> {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId }
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }
  }

  private assertUploadFile(file: UploadedPhotoFile | undefined): asserts file is UploadedPhotoFile {
    if (!file) {
      throw new BadRequestException('Photo file is required');
    }

    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only browser-supported image formats are allowed');
    }

    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Photo size exceeds 15 MB limit');
    }
  }

  private resolveFileExtension(originalName: string, mimeType: string): string {
    const parsed = path.extname(originalName || '').toLowerCase();
    if (parsed) {
      return parsed;
    }

    if (mimeType.includes('png')) {
      return '.png';
    }
    if (mimeType.includes('gif')) {
      return '.gif';
    }
    if (mimeType.includes('webp')) {
      return '.webp';
    }

    return '.jpg';
  }

  private toPhotoResponse(photo: ItemPhotoRecord): Record<string, unknown> {
    return {
      id: photo.id,
      itemId: photo.itemId,
      relativePath: photo.relativePath,
      mimeType: photo.mimeType,
      sizeBytes: photo.sizeBytes,
      position: photo.position,
      isMain: photo.isMain,
      createdAt: photo.createdAt,
      updatedAt: photo.updatedAt
    };
  }
}
