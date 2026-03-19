import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { BulkAdjustStockDto } from './dto/bulk-adjust-stock.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateItemDto } from './dto/create-item.dto';
import {
  type InventoryLayout,
  type InventorySortField,
  type InventorySortOrder,
  ListItemsQueryDto
} from './dto/list-items-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateItemDto } from './dto/update-item.dto';

type CategoryWithItemsCount = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    items: number;
  };
};

type ItemPhotoRef = {
  id: string;
  relativePath: string;
  isMain: boolean;
  position: number;
};

type ItemWithRelations = {
  id: string;
  name: string;
  code: string;
  quantity: number;
  notes: string | null;
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
  category?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  photos?: ItemPhotoRef[];
};

type StockAdjustmentRow = {
  itemId: string;
  itemName: string;
  itemCode: string;
  beforeQuantity: number;
  afterQuantity: number;
  delta: number;
  reason: string;
};

const QUICK_ACTIONS = ['edit', 'adjustStock', 'photos', 'delete'] as const;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async listCategories(): Promise<Array<Record<string, unknown>>> {
    const categories = await this.prisma.category.findMany({
      include: {
        _count: {
          select: {
            items: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return categories.map((category) => this.toCategoryResponse(category));
  }

  async createCategory(
    dto: CreateCategoryDto,
    actorUserId: string | null
  ): Promise<Record<string, unknown>> {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Category name is required');
    }

    const existing = await this.prisma.category.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive'
        }
      }
    });
    if (existing) {
      throw new BadRequestException('Category with this name already exists');
    }

    const category = await this.prisma.category.create({
      data: {
        name,
        description: this.normalizeOptionalText(dto.description)
      },
      include: {
        _count: {
          select: {
            items: true
          }
        }
      }
    });

    await this.auditService.record({
      action: 'inventory.category.created',
      entityType: 'category',
      entityId: category.id,
      actorUserId,
      metadata: {
        name: category.name
      }
    });

    return this.toCategoryResponse(category);
  }

  async updateCategory(
    categoryId: string,
    dto: UpdateCategoryDto,
    actorUserId: string | null
  ): Promise<Record<string, unknown>> {
    const existing = await this.prisma.category.findUnique({
      where: { id: categoryId }
    });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    const data: Prisma.CategoryUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('Category name is required');
      }

      const duplicate = await this.prisma.category.findFirst({
        where: {
          id: {
            not: categoryId
          },
          name: {
            equals: name,
            mode: 'insensitive'
          }
        }
      });

      if (duplicate) {
        throw new BadRequestException('Category with this name already exists');
      }

      data.name = name;
    }

    if (dto.description !== undefined) {
      data.description = this.normalizeOptionalText(dto.description);
    }

    const category = await this.prisma.category.update({
      where: { id: categoryId },
      data,
      include: {
        _count: {
          select: {
            items: true
          }
        }
      }
    });

    await this.auditService.record({
      action: 'inventory.category.updated',
      entityType: 'category',
      entityId: category.id,
      actorUserId,
      metadata: {
        name: category.name
      }
    });

    return this.toCategoryResponse(category);
  }

  async deleteCategory(
    categoryId: string,
    force: boolean,
    actorUserId: string | null
  ): Promise<{ deleted: true; id: string; force: boolean }> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId }
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const itemCount = await this.prisma.item.count({
      where: {
        categoryId
      }
    });

    if (itemCount > 0 && !force) {
      throw new ConflictException(
        'Category has dependent items. Use force=true to hard delete with cascade.'
      );
    }

    if (force && itemCount > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.item.deleteMany({
          where: {
            categoryId
          }
        });
        await tx.category.delete({
          where: {
            id: categoryId
          }
        });
      });
    } else {
      await this.prisma.category.delete({
        where: {
          id: categoryId
        }
      });
    }

    await this.auditService.record({
      action: 'inventory.category.deleted',
      entityType: 'category',
      entityId: categoryId,
      actorUserId,
      metadata: {
        force,
        removedItemsCount: force ? itemCount : 0
      }
    });

    return {
      deleted: true,
      id: categoryId,
      force
    };
  }

  async listItems(query: ListItemsQueryDto = {}): Promise<Array<Record<string, unknown>>> {
    const where: Prisma.ItemWhereInput = {};

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

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
          code: {
            contains: normalizedSearch,
            mode: 'insensitive'
          }
        }
      ];
    }

    if (query.hideUnavailable === true) {
      where.quantity = {
        gt: 0
      };
    }

    const sortBy = query.sortBy ?? 'name';
    const sortOrder = query.sortOrder ?? 'asc';
    const layout = query.layout ?? 'compact';

    const items = await this.prisma.item.findMany({
      where,
      include: {
        category: true,
        photos: {
          select: {
            id: true,
            relativePath: true,
            isMain: true,
            position: true
          },
          orderBy: {
            position: 'asc'
          }
        }
      },
      orderBy: this.resolveItemSort(sortBy, sortOrder)
    });

    return items.map((item) => this.toItemResponse(item, layout));
  }

  async getItem(itemId: string): Promise<Record<string, unknown>> {
    const item = await this.prisma.item.findUnique({
      where: {
        id: itemId
      },
      include: {
        category: true,
        photos: {
          select: {
            id: true,
            relativePath: true,
            isMain: true,
            position: true
          },
          orderBy: {
            position: 'asc'
          }
        }
      }
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return this.toItemResponse(item, 'compact');
  }

  async createItem(dto: CreateItemDto, actorUserId: string | null): Promise<Record<string, unknown>> {
    const category = await this.prisma.category.findUnique({
      where: {
        id: dto.categoryId
      }
    });
    if (!category) {
      throw new BadRequestException('Category not found');
    }

    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Item name is required');
    }

    const quantity = dto.quantity ?? 0;
    if (quantity < 0) {
      throw new BadRequestException('Quantity cannot be negative');
    }

    const code = dto.code ? this.normalizeCode(dto.code) : await this.generateItemCode();
    await this.ensureUniqueItemCode(code, null);

    const item = await this.prisma.item.create({
      data: {
        name,
        code,
        quantity,
        notes: this.normalizeOptionalText(dto.notes),
        categoryId: dto.categoryId
      },
      include: {
        category: true,
        photos: {
          select: {
            id: true,
            relativePath: true,
            isMain: true,
            position: true
          },
          orderBy: {
            position: 'asc'
          }
        }
      }
    });

    await this.auditService.record({
      action: 'inventory.item.created',
      entityType: 'item',
      entityId: item.id,
      actorUserId,
      metadata: {
        code: item.code,
        categoryId: item.categoryId,
        quantity: item.quantity
      }
    });

    return this.toItemResponse(item, 'compact');
  }

  async updateItem(
    itemId: string,
    dto: UpdateItemDto,
    actorUserId: string | null
  ): Promise<Record<string, unknown>> {
    const existing = await this.prisma.item.findUnique({
      where: {
        id: itemId
      }
    });
    if (!existing) {
      throw new NotFoundException('Item not found');
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: {
          id: dto.categoryId
        }
      });

      if (!category) {
        throw new BadRequestException('Category not found');
      }
    }

    const data: Prisma.ItemUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('Item name is required');
      }
      data.name = name;
    }
    if (dto.notes !== undefined) {
      data.notes = this.normalizeOptionalText(dto.notes);
    }
    if (dto.categoryId !== undefined) {
      data.category = {
        connect: {
          id: dto.categoryId
        }
      };
    }
    if (dto.code !== undefined) {
      const normalizedCode = this.normalizeCode(dto.code);
      await this.ensureUniqueItemCode(normalizedCode, itemId);
      data.code = normalizedCode;
    }

    const item = await this.prisma.item.update({
      where: {
        id: itemId
      },
      data,
      include: {
        category: true,
        photos: {
          select: {
            id: true,
            relativePath: true,
            isMain: true,
            position: true
          },
          orderBy: {
            position: 'asc'
          }
        }
      }
    });

    await this.auditService.record({
      action: 'inventory.item.updated',
      entityType: 'item',
      entityId: item.id,
      actorUserId,
      metadata: {
        code: item.code,
        categoryId: item.categoryId
      }
    });

    return this.toItemResponse(item, 'compact');
  }

  async deleteItem(
    itemId: string,
    force: boolean,
    actorUserId: string | null
  ): Promise<{ deleted: true; id: string; force: boolean }> {
    const existing = await this.prisma.item.findUnique({
      where: {
        id: itemId
      }
    });
    if (!existing) {
      throw new NotFoundException('Item not found');
    }

    const [photoCount, adjustmentCount] = await Promise.all([
      this.prisma.itemPhoto.count({
        where: {
          itemId
        }
      }),
      this.prisma.stockAdjustment.count({
        where: {
          itemId
        }
      })
    ]);

    if (!force && (photoCount > 0 || adjustmentCount > 0)) {
      throw new ConflictException(
        'Item has dependent records. Use force=true to hard delete with cascade.'
      );
    }

    await this.prisma.item.delete({
      where: {
        id: itemId
      }
    });

    await this.auditService.record({
      action: 'inventory.item.deleted',
      entityType: 'item',
      entityId: itemId,
      actorUserId,
      metadata: {
        force,
        deletedPhotoCount: force ? photoCount : 0,
        deletedAdjustmentCount: force ? adjustmentCount : 0
      }
    });

    return {
      deleted: true,
      id: itemId,
      force
    };
  }

  async previewStockAdjustments(dto: BulkAdjustStockDto): Promise<Array<Record<string, unknown>>> {
    const rows = await this.buildStockAdjustmentRows(dto);
    return rows.map((row) => this.toStockAdjustmentResponse(row));
  }

  async applyStockAdjustments(
    dto: BulkAdjustStockDto,
    actorUserId: string | null
  ): Promise<Array<Record<string, unknown>>> {
    const rows = await this.buildStockAdjustmentRows(dto);

    await this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        await tx.item.update({
          where: {
            id: row.itemId
          },
          data: {
            quantity: row.afterQuantity
          }
        });

        await tx.stockAdjustment.create({
          data: {
            itemId: row.itemId,
            actorUserId,
            reason: row.reason,
            beforeQuantity: row.beforeQuantity,
            afterQuantity: row.afterQuantity,
            delta: row.delta
          }
        });
      }
    });

    for (const row of rows) {
      await this.auditService.record({
        action: 'inventory.stock.adjusted',
        entityType: 'item',
        entityId: row.itemId,
        actorUserId,
        metadata: {
          reason: row.reason,
          beforeQuantity: row.beforeQuantity,
          afterQuantity: row.afterQuantity,
          delta: row.delta
        }
      });
    }

    return rows.map((row) => this.toStockAdjustmentResponse(row));
  }

  private async buildStockAdjustmentRows(dto: BulkAdjustStockDto): Promise<StockAdjustmentRow[]> {
    if (dto.adjustments.length === 0) {
      throw new BadRequestException('At least one adjustment is required');
    }

    const seen = new Set<string>();
    for (const adjustment of dto.adjustments) {
      if (seen.has(adjustment.itemId)) {
        throw new BadRequestException('Duplicate item in stock adjustment payload');
      }
      seen.add(adjustment.itemId);
    }

    const itemIds = dto.adjustments.map((adjustment) => adjustment.itemId);
    const items = await this.prisma.item.findMany({
      where: {
        id: {
          in: itemIds
        }
      }
    });

    const byId = new Map(items.map((item) => [item.id, item]));
    const rows: StockAdjustmentRow[] = [];

    for (const adjustment of dto.adjustments) {
      const item = byId.get(adjustment.itemId);
      if (!item) {
        throw new BadRequestException(`Item not found: ${adjustment.itemId}`);
      }

      if (adjustment.quantity < 0) {
        throw new BadRequestException('Quantity cannot be negative');
      }

      const reason = adjustment.reason.trim();
      if (!reason) {
        throw new BadRequestException('Reason is required');
      }

      rows.push({
        itemId: item.id,
        itemName: item.name,
        itemCode: item.code,
        beforeQuantity: item.quantity,
        afterQuantity: adjustment.quantity,
        delta: adjustment.quantity - item.quantity,
        reason
      });
    }

    return rows;
  }

  private resolveItemSort(
    sortBy: InventorySortField,
    sortOrder: InventorySortOrder
  ): Prisma.ItemOrderByWithRelationInput {
    if (sortBy === 'code') {
      return { code: sortOrder };
    }
    if (sortBy === 'quantity') {
      return { quantity: sortOrder };
    }
    if (sortBy === 'updatedAt') {
      return { updatedAt: sortOrder };
    }

    return { name: sortOrder };
  }

  private normalizeOptionalText(value: string | undefined): string | null {
    if (value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeCode(value: string): string {
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      throw new BadRequestException('Item code cannot be empty');
    }
    return normalized;
  }

  private async ensureUniqueItemCode(code: string, excludeItemId: string | null): Promise<void> {
    const duplicate = await this.prisma.item.findFirst({
      where: {
        code,
        id: excludeItemId
          ? {
              not: excludeItemId
            }
          : undefined
      }
    });

    if (duplicate) {
      throw new BadRequestException('Duplicate item code');
    }
  }

  private async generateItemCode(): Promise<string> {
    const existingCodes = await this.prisma.item.findMany({
      select: {
        code: true
      }
    });

    let maxSequence = 0;
    for (const entry of existingCodes) {
      const match = /^ITM-(\d+)$/.exec(entry.code);
      if (!match) {
        continue;
      }
      const sequence = Number.parseInt(match[1], 10);
      if (!Number.isNaN(sequence)) {
        maxSequence = Math.max(maxSequence, sequence);
      }
    }

    const nextSequence = String(maxSequence + 1).padStart(4, '0');
    return `ITM-${nextSequence}`;
  }

  private toCategoryResponse(category: CategoryWithItemsCount): Record<string, unknown> {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      itemCount: category._count?.items ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt
    };
  }

  private toItemResponse(item: ItemWithRelations, layout: InventoryLayout): Record<string, unknown> {
    const sortedPhotos = [...(item.photos ?? [])].sort((a, b) => a.position - b.position);
    const mainPhoto =
      sortedPhotos.find((photo) => photo.isMain) ??
      sortedPhotos[0] ??
      null;

    return {
      id: item.id,
      name: item.name,
      code: item.code,
      quantity: item.quantity,
      notes: item.notes,
      categoryId: item.categoryId,
      category: item.category
        ? {
            id: item.category.id,
            name: item.category.name,
            description: item.category.description
          }
        : null,
      isUnavailable: item.quantity <= 0,
      mainPhoto: mainPhoto
        ? {
            id: mainPhoto.id,
            relativePath: mainPhoto.relativePath
          }
        : null,
      galleryCount: sortedPhotos.length,
      allowedActions: [...QUICK_ACTIONS],
      layout,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }

  private toStockAdjustmentResponse(row: StockAdjustmentRow): Record<string, unknown> {
    return {
      itemId: row.itemId,
      itemName: row.itemName,
      itemCode: row.itemCode,
      beforeQuantity: row.beforeQuantity,
      afterQuantity: row.afterQuantity,
      delta: row.delta,
      reason: row.reason
    };
  }
}
