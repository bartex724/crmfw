import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateBoxDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  boxCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
