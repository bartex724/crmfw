import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class ConfirmSensitiveActionDto {
  @IsBoolean()
  confirmed!: boolean;

  @IsString()
  @MinLength(3)
  action!: string;

  @IsString()
  @MinLength(1)
  targetUserId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
