import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const EVENT_SORT_FIELDS = ['eventDate', 'updatedAt', 'name'] as const;
export const EVENT_SORT_ORDERS = ['asc', 'desc'] as const;

export type EventSortField = (typeof EVENT_SORT_FIELDS)[number];
export type EventSortOrder = (typeof EVENT_SORT_ORDERS)[number];

export class ListEventsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  search?: string;

  @IsOptional()
  @IsIn(EVENT_SORT_FIELDS)
  sortBy?: EventSortField;

  @IsOptional()
  @IsIn(EVENT_SORT_ORDERS)
  sortOrder?: EventSortOrder;
}
