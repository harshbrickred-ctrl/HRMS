import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class NameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

export class CreateTeamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(1)
  departmentId!: string;

  @IsOptional()
  @IsString()
  managerId?: string;
}

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  managerId?: string | null;
}

export class CreateEmployeeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(80)
  password!: string;

  @IsString()
  @MaxLength(80)
  designation!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  roleCodes!: string[];

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  managerId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  designation?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  roleCodes?: string[];

  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @IsOptional()
  @IsString()
  locationId?: string | null;

  @IsOptional()
  @IsString()
  teamId?: string | null;

  @IsOptional()
  @IsString()
  managerId?: string | null;

  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(80)
  password?: string;
}

export class LeaveBalanceInput {
  @IsString()
  code!: string;

  @IsNumber()
  @Min(0)
  entitled!: number;

  @IsNumber()
  @Min(0)
  used!: number;

  @IsNumber()
  @Min(0)
  pending!: number;
}

export class UpdateLeaveBalancesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LeaveBalanceInput)
  balances!: LeaveBalanceInput[];
}

export class AdjustLeaveDto {
  @IsString()
  code!: string;

  @IsNumber()
  @Min(0.5)
  days!: number;

  @IsIn(['apply', 'withdraw'])
  direction!: 'apply' | 'withdraw';
}
