import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class PasswordResetVerifyDto {
  @IsEmail()
  @IsString()
  email!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp!: string;
}
