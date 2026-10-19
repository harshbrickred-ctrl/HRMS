import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class PunchDto {
  @IsIn(['IN', 'OUT'])
  direction!: 'IN' | 'OUT';
}

export class CorrectionDto {
  @IsString()
  date!: string;

  @IsIn(['present', 'absent', 'leave'])
  requestedStatus!: 'present' | 'absent' | 'leave';

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  checkIn?: string;

  @IsOptional()
  @IsString()
  checkOut?: string;
}

export class DecisionDto {
  @IsIn(['Approved', 'Rejected'])
  status!: 'Approved' | 'Rejected';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ShiftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;

  @IsInt()
  @Min(0)
  @Max(240)
  breakMinutes!: number;

  @IsOptional()
  @IsBoolean()
  overnight?: boolean;
}

export class AssignmentDto {
  @IsString()
  employeeId!: string;

  @IsString()
  shiftId!: string;

  @IsString()
  effectiveFrom!: string;
}

export class HolidayDto {
  @IsString()
  date!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  locationId?: string;
}

export class PolicyDto {
  @IsOptional()
  @IsString()
  timeZone?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  graceMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  halfDayMaxMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  duplicateWindowMinutes?: number;

  @IsOptional()
  @IsBoolean()
  webPunchEnabled?: boolean;
}

export class DeviceDto {
  @IsString()
  @MinLength(1)
  serial!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsString()
  timeZone?: string;

  @IsOptional()
  @IsIn(['device', 'inferred'])
  directionMode?: 'device' | 'inferred';

  @IsOptional()
  @IsString()
  model?: string;
}

export class CommKeyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  commKey!: string;
}

export class EnrollmentDto {
  @IsString()
  employeeId!: string;

  @IsString()
  @MinLength(1)
  pin!: string;
}

export class MapPunchDto {
  @IsString()
  employeeId!: string;
}

export class OverrideDto {
  @IsIn(['present', 'absent', 'leave'])
  status!: 'present' | 'absent' | 'leave';

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  checkIn?: string;

  @IsOptional()
  @IsString()
  checkOut?: string;
}
