import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ApplyLeaveDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  fromDate!: string;

  @IsString()
  toDate!: string;

  @IsOptional()
  @IsBoolean()
  halfDayStart?: boolean;

  @IsOptional()
  @IsBoolean()
  halfDayEnd?: boolean;

  @IsOptional()
  @IsBoolean()
  fromHalfStart?: boolean;

  @IsOptional()
  @IsBoolean()
  fromHalfEnd?: boolean;

  @IsOptional()
  @IsBoolean()
  toHalfStart?: boolean;

  @IsOptional()
  @IsBoolean()
  toHalfEnd?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ApplyLeaveForEmployeeDto extends ApplyLeaveDto {
  @IsString()
  @MinLength(1)
  employeeId!: string;
}

export class LeaveDecisionDto {
  @IsIn(['Approved', 'Rejected'])
  status!: 'Approved' | 'Rejected';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
