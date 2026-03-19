import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { ROLES } from '../../access/roles';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(ROLES)
  role!: (typeof ROLES)[number];
}
