import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name!: string;

  @IsDateString()
  eventDate!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  location!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
