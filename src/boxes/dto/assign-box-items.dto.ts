import { ArrayUnique, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class AssignBoxItemsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  itemIds!: string[];
}
