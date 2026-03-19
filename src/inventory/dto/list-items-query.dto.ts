import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const INVENTORY_SORT_FIELDS = ['name', 'code', 'quantity', 'updatedAt'] as const;
export const INVENTORY_SORT_ORDERS = ['asc', 'desc'] as const;
export const INVENTORY_LAYOUTS = ['compact', 'cards', 'dense'] as const;

export type InventorySortField = (typeof INVENTORY_SORT_FIELDS)[number];
export type InventorySortOrder = (typeof INVENTORY_SORT_ORDERS)[number];
export type InventoryLayout = (typeof INVENTORY_LAYOUTS)[number];

export class ListItemsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === '1') {
      return true;
    }
    if (value === false || value === 'false' || value === '0') {
      return false;
    }
    return value;
  })
  hideUnavailable?: boolean;

  @IsOptional()
  @IsIn(INVENTORY_SORT_FIELDS)
  sortBy?: InventorySortField;

  @IsOptional()
  @IsIn(INVENTORY_SORT_ORDERS)
  sortOrder?: InventorySortOrder;

  @IsOptional()
  @IsIn(INVENTORY_LAYOUTS)
  layout?: InventoryLayout;
}
