import { Transform } from 'class-transformer';
import { EventItemStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

function parseBooleanValue(value: unknown): unknown {
  if (value === true || value === 'true' || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === '0') {
    return false;
  }
  return value;
}

export class UpdateEventItemStatusDto {
  @IsEnum(EventItemStatus)
  status!: EventItemStatus;

  @IsOptional()
  @Transform(({ value }) => parseBooleanValue(value))
  forceToPack?: boolean;
}
