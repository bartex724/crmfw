import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { AdjustStockDto } from './adjust-stock.dto';

export class BulkAdjustStockDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AdjustStockDto)
  adjustments!: AdjustStockDto[];
}
