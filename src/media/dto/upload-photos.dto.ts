import { Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';

export class UploadPhotosDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === '1') {
      return true;
    }
    if (value === false || value === 'false' || value === '0') {
      return false;
    }
    return value;
  })
  isMain?: boolean;
}
