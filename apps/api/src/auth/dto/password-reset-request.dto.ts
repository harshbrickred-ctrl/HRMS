import { IsEmail, IsString, MinLength } from 'class-validator';

export class PasswordResetRequestDto {
  @IsEmail()
  @IsString()
  email!: string;
}
