import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { PERMISSIONS } from '../access/permissions';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { SessionAuthGuard } from '../auth/auth.service';
import { BulkAdjustStockDto } from './dto/bulk-adjust-stock.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { ListItemsQueryDto } from './dto/list-items-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { InventoryService } from './inventory.service';

type AuthenticatedRequest = {
  user?: {
    id: string;
  };
};

@Controller('inventory')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('categories')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  async listCategories(): Promise<{ categories: unknown[] }> {
    const categories = await this.inventoryService.listCategories();
    return { categories };
  }

  @Post('categories')
  @RequirePermissions(PERMISSIONS.INVENTORY_WRITE)
  async createCategory(
    @Body() body: CreateCategoryDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ category: unknown }> {
    const category = await this.inventoryService.createCategory(body, request.user?.id ?? null);
    return { category };
  }

  @Patch('categories/:id')
  @RequirePermissions(PERMISSIONS.INVENTORY_WRITE)
  async updateCategory(
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ category: unknown }> {
    const category = await this.inventoryService.updateCategory(id, body, request.user?.id ?? null);
    return { category };
  }

  @Delete('categories/:id')
  @RequirePermissions(PERMISSIONS.INVENTORY_WRITE)
  async deleteCategory(
    @Param('id') id: string,
    @Query('force') force: string | undefined,
    @Req() request: AuthenticatedRequest
  ): Promise<{ deleted: true; id: string; force: boolean }> {
    const result = await this.inventoryService.deleteCategory(
      id,
      this.parseForce(force),
      request.user?.id ?? null
    );
    return result;
  }

  @Get('items')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  async listItems(@Query() query: ListItemsQueryDto): Promise<{ items: unknown[]; layout: string }> {
    const items = await this.inventoryService.listItems(query);
    return { items, layout: query.layout ?? 'compact' };
  }

  @Post('items/stock/preview')
  @RequirePermissions(PERMISSIONS.INVENTORY_WRITE)
  async previewStockAdjustments(
    @Body() body: BulkAdjustStockDto
  ): Promise<{ rows: unknown[]; mode: 'preview' }> {
    const rows = await this.inventoryService.previewStockAdjustments(body);
    return { rows, mode: 'preview' };
  }

  @Post('items/stock/apply')
  @RequirePermissions(PERMISSIONS.INVENTORY_WRITE)
  async applyStockAdjustments(
    @Body() body: BulkAdjustStockDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ rows: unknown[]; mode: 'applied' }> {
    const rows = await this.inventoryService.applyStockAdjustments(body, request.user?.id ?? null);
    return { rows, mode: 'applied' };
  }

  @Get('items/:id')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  async getItem(@Param('id') id: string): Promise<{ item: unknown }> {
    const item = await this.inventoryService.getItem(id);
    return { item };
  }

  @Post('items')
  @RequirePermissions(PERMISSIONS.INVENTORY_WRITE)
  async createItem(
    @Body() body: CreateItemDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ item: unknown }> {
    const item = await this.inventoryService.createItem(body, request.user?.id ?? null);
    return { item };
  }

  @Patch('items/:id')
  @RequirePermissions(PERMISSIONS.INVENTORY_WRITE)
  async updateItem(
    @Param('id') id: string,
    @Body() body: UpdateItemDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ item: unknown }> {
    const item = await this.inventoryService.updateItem(id, body, request.user?.id ?? null);
    return { item };
  }

  @Delete('items/:id')
  @RequirePermissions(PERMISSIONS.INVENTORY_WRITE)
  async deleteItem(
    @Param('id') id: string,
    @Query('force') force: string | undefined,
    @Req() request: AuthenticatedRequest
  ): Promise<{ deleted: true; id: string; force: boolean }> {
    const result = await this.inventoryService.deleteItem(
      id,
      this.parseForce(force),
      request.user?.id ?? null
    );
    return result;
  }

  private parseForce(force: string | undefined): boolean {
    return force === '1' || force === 'true';
  }
}
