import { IsString, MinLength } from 'class-validator';

export class PasswordResetConfirmDto {
  @IsString()
  @MinLength(20)
  resetToken!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
