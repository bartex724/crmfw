import { Type } from 'class-transformer';
import { IsInt, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class AdjustStockDto {
  @IsUUID()
  itemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}
