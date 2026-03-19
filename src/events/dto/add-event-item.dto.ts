import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min } from 'class-validator';

export class AddEventItemDto {
  @IsString()
  @MaxLength(120)
  itemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  plannedQuantity!: number;
}
