import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class UpdateEventItemReconciliationDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lostQuantity!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  returnedQuantity!: number;
}
