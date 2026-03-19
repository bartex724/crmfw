import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const BOX_SORT_FIELDS = ['boxCode', 'name', 'updatedAt'] as const;
export const BOX_SORT_ORDERS = ['asc', 'desc'] as const;

export type BoxSortField = (typeof BOX_SORT_FIELDS)[number];
export type BoxSortOrder = (typeof BOX_SORT_ORDERS)[number];

export class ListBoxesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsIn(BOX_SORT_FIELDS)
  sortBy?: BoxSortField;

  @IsOptional()
  @IsIn(BOX_SORT_ORDERS)
  sortOrder?: BoxSortOrder;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
