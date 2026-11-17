import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export class SaveStructureDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  monthlyGross!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  basic?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  hra?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  da?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  otherAllowances?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  dailyAllowance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  statutoryBonus?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  gratuityMonthly?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  leaveEncashment?: number;

  @IsOptional()
  @IsBoolean()
  pfOnActual?: boolean;

  @IsIn(['new', 'old'])
  taxRegime!: 'new' | 'old';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ptMonthly?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  annualDeductions?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ytdTaxable?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ytdTds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ytdPt?: number;
}

export class MonthDto {
  @IsString()
  @Matches(MONTH)
  month!: string;
}

export class CreateTransferBatchDto extends MonthDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  employeeIds!: string[];
}

export class LockMonthDto extends MonthDto {
  @IsBoolean()
  locked!: boolean;
}

export class BankFileDto extends MonthDto {
  @IsIn(['hdfc', 'icici', 'sbi', 'axis'])
  template!: 'hdfc' | 'icici' | 'sbi' | 'axis';

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  employeeIds!: string[];
}

export class PayoutUpdateDto {
  @IsString()
  employeeId!: string;

  @IsIn(['paid', 'failed'])
  status!: 'paid' | 'failed';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  utr?: string;
}

export class ReconcilePayoutDto extends MonthDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PayoutUpdateDto)
  updates!: PayoutUpdateDto[];
}

export class RetryPayoutDto extends MonthDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  employeeIds!: string[];
}

export class TransferOtpDto {
  @Matches(/^\d{6}$/)
  otp!: string;
}

export class AuthoriseTransferDto {
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';
}

export class UploadSalaryDto {
  @IsIn(['structure', 'month'])
  kind!: 'structure' | 'month';

  @IsOptional()
  @IsString()
  @Matches(MONTH)
  month?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500_000)
  csv!: string;
}

export class SaveMonthDto extends MonthDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lopDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bonus?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  overtime?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  incentive?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  arrears?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  loanRecovery?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  advanceRecovery?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  otherDeduction?: number;
}
