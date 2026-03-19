import { Transform } from 'class-transformer';
import { EventItemStatus } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

function parseBooleanValue(value: unknown): unknown {
  if (value === true || value === 'true' || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === '0') {
    return false;
  }
  return value;
}

export class BulkUpdateEventItemStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  eventItemIds!: string[];

  @IsEnum(EventItemStatus)
  status!: EventItemStatus;

  @IsOptional()
  @Transform(({ value }) => parseBooleanValue(value))
  forceToPack?: boolean;
}
