import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderPhotosDto {
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => String)
  @IsUUID(undefined, { each: true })
  photoIds!: string[];
}
