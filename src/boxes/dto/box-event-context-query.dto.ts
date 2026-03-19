import { IsOptional, IsUUID } from 'class-validator';

export class BoxEventContextQueryDto {
  @IsOptional()
  @IsUUID()
  eventId?: string;
}
