import { Transform } from 'class-transformer';
import { EventItemStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const EVENT_ITEM_SORT_FIELDS = ['name', 'status', 'plannedQuantity'] as const;
export const EVENT_ITEM_SORT_ORDERS = ['asc', 'desc'] as const;

export type EventItemSortField = (typeof EVENT_ITEM_SORT_FIELDS)[number];
export type EventItemSortOrder = (typeof EVENT_ITEM_SORT_ORDERS)[number];

function parseBooleanValue(value: unknown): unknown {
  if (value === true || value === 'true' || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === '0') {
    return false;
  }
  return value;
}

export class ListEventItemsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  search?: string;

  @IsOptional()
  @IsEnum(EventItemStatus)
  status?: EventItemStatus;

  @IsOptional()
  @Transform(({ value }) => parseBooleanValue(value))
  unresolvedOnly?: boolean;

  @IsOptional()
  @IsIn(EVENT_ITEM_SORT_FIELDS)
  sortBy?: EventItemSortField;

  @IsOptional()
  @IsIn(EVENT_ITEM_SORT_ORDERS)
  sortOrder?: EventItemSortOrder;
}
