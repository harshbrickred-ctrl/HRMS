import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const ISSUE_CONDITIONS = ['new', 'good', 'fair', 'damaged'] as const;
const RETURN_CONDITIONS = ['good', 'damaged', 'requires_repair', 'missing_components'] as const;
const LIFECYCLE_STATUSES = [
  'in_stock',
  'allocated',
  'under_maintenance',
  'lost',
  'retired',
  'disposed',
  'written_off',
] as const;
const ISSUE_FIELDS_LIMIT = 1000;
const FAULT_CATEGORIES = ['hardware', 'software', 'physical_damage', 'battery', 'accessories_missing', 'other'] as const;
const PRIORITIES = ['low', 'medium', 'high'] as const;
const TICKET_STATUSES = ['Open', 'InProgress', 'Resolved', 'Closed'] as const;
const FIELD_TYPES = ['text', 'number', 'date'] as const;

class AssetFieldsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  make?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  serialNo?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  purchasedOn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  vendor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  owner?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  cost?: number | null;

  @IsOptional()
  @IsDateString({ strict: true })
  warrantyExpiry?: string | null;

  @IsOptional()
  @IsString()
  locationId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

/** The asset tag is always generated, so it is not accepted here. */
export class CreateAssetDto extends AssetFieldsDto {
  @IsString()
  @MinLength(1)
  categoryId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;
}

/** Status changes only through assign and return. */
export class UpdateAssetDto extends AssetFieldsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;
}

class CategoryFieldDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{0,39}$/)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @IsIn(FIELD_TYPES)
  type!: (typeof FIELD_TYPES)[number];

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class CreateAssetCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsString()
  @Matches(/^[A-Z0-9]{2,8}$/, { message: 'Tag prefix must be 2-8 capital letters or digits.' })
  tagPrefix!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CategoryFieldDto)
  fields?: CategoryFieldDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  usefulLifeMonths?: number;
}

export class UpdateAssetCategoryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  usefulLifeMonths?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{2,8}$/, { message: 'Tag prefix must be 2-8 capital letters or digits.' })
  tagPrefix?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CategoryFieldDto)
  fields?: CategoryFieldDto[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AllocateAssetDto {
  @IsString()
  @MinLength(1)
  employeeId!: string;

  @IsOptional()
  @IsDateString({ strict: true })
  issuedOn?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  expectedReturnOn?: string;

  @IsIn(ISSUE_CONDITIONS)
  condition!: (typeof ISSUE_CONDITIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  accessories?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /** Working days the employee has to accept it. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  ackWithinDays?: number;

  @IsOptional()
  @IsBoolean()
  notifyManager?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  project?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactMobile?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  employmentType?: string;
}

/** Sent as multipart form data alongside the return photos. */
export class ReturnAssetDto {
  @IsOptional()
  @IsDateString({ strict: true })
  returnedOn?: string;

  @IsIn(RETURN_CONDITIONS)
  condition!: (typeof RETURN_CONDITIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  damageNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  inspectionNotes?: string;
}

export class TransferAssetDto {
  @IsString()
  @MinLength(1)
  toEmployeeId!: string;

  @IsOptional()
  @IsDateString({ strict: true })
  transferredOn?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class ChangeAssetStatusDto {
  @IsIn(LIFECYCLE_STATUSES)
  status!: (typeof LIFECYCLE_STATUSES)[number];

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class SignedFormDto {
  @IsIn(['signed_ack', 'handover_ack'])
  kind!: 'signed_ack' | 'handover_ack';
}

/** General questions about an asset. Faults, losses, and requests have their own forms. */
export class CreateAssetTicketDto {
  @IsString()
  @MinLength(1)
  assetId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

/** Sent as multipart form data alongside any attachments. */
export class FaultReportDto {
  @IsString()
  @MinLength(1)
  allocationId!: string;

  @IsIn(FAULT_CATEGORIES)
  category!: (typeof FAULT_CATEGORIES)[number];

  @IsIn(PRIORITIES)
  priority!: (typeof PRIORITIES)[number];

  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  description!: string;
}

/** Sent as multipart form data alongside any attachments. */
export class LossReportDto {
  @IsString()
  @MinLength(1)
  allocationId!: string;

  @IsIn(['lost', 'stolen'])
  reportType!: 'lost' | 'stolen';

  @IsDateString({ strict: true })
  lostOn!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  location!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  description!: string;
}

export class ReturnRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class RequestQuestionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  question!: string;
}

export class MaintenanceStageDto {
  @IsIn(['with_vendor', 'testing', 'ready'])
  stage!: 'with_vendor' | 'testing' | 'ready';
}

export class UpdateAssetTicketDto {
  @IsIn(TICKET_STATUSES)
  status!: (typeof TICKET_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateAssetRequestDto {
  @IsString()
  @MinLength(1)
  categoryId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(ISSUE_FIELDS_LIMIT)
  reason!: string;
}

export class RequestDecisionDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(ISSUE_FIELDS_LIMIT)
  note?: string;
}

export class FulfilAssetRequestDto {
  @IsString()
  @MinLength(1)
  assetId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  ackWithinDays?: number;

  @IsOptional()
  @IsBoolean()
  notifyManager?: boolean;

  @IsOptional()
  @IsDateString({ strict: true })
  issuedOn?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  expectedReturnOn?: string;

  @IsIn(ISSUE_CONDITIONS)
  condition!: (typeof ISSUE_CONDITIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  accessories?: string;

  @IsOptional()
  @IsString()
  @MaxLength(ISSUE_FIELDS_LIMIT)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  project?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactMobile?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  employmentType?: string;
}

/** A cell of the asset register sheet, exactly as typed. The server reads and checks each one. */
const SheetCell = () => applyDecorators(IsOptional(), IsString(), MaxLength(500));

/** One row of the asset register sheet. Columns the system works out itself (S.No, Reporting Manager) are not sent. */
export class AssetSheetRowDto {
  /** Line in the file, for error messages. */
  @IsInt()
  @Min(1)
  line!: number;

  @SheetCell() vendor?: string;
  @SheetCell() purchasedOn?: string;
  @SheetCell() owner?: string;
  @SheetCell() assignTo?: string;
  @SheetCell() project?: string;
  @SheetCell() name?: string;
  @SheetCell() processor?: string;
  @SheetCell() make?: string;
  @SheetCell() model?: string;
  @SheetCell() serialNo?: string;
  @SheetCell() workingStatus?: string;
  @SheetCell() assignedToEmployee?: string;
  @SheetCell() assignedOn?: string;
  @SheetCell() employeeCode?: string;
  @SheetCell() email?: string;
  @SheetCell() mobile?: string;
  @SheetCell() assignedReceived?: string;
  @SheetCell() employmentType?: string;
  @SheetCell() bag?: string;
  @SheetCell() charger?: string;
  @SheetCell() mouse?: string;
  @SheetCell() headphone?: string;
  @SheetCell() keyboard?: string;
  @SheetCell() os?: string;
  @SheetCell() ram?: string;
  @SheetCell() storage?: string;
  @SheetCell() condition?: string;
  @SheetCell() remarks?: string;
}

export class ImportAssetSheetDto {
  /** The sheet has no category column, so the person importing picks one for every row. */
  @IsString()
  @MinLength(1)
  categoryId!: string;

  @IsOptional()
  @IsString()
  locationId?: string | null;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AssetSheetRowDto)
  rows!: AssetSheetRowDto[];
}

export class DepartmentHeadDto {
  @IsOptional()
  @IsString()
  headId?: string | null;
}

export class OpenMaintenanceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(ISSUE_FIELDS_LIMIT)
  issue!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  vendor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  vendorContact?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  startedOn?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  expectedOn?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  estimatedCost?: number;

  /** The employee's fault report this repair answers, if any. */
  @IsOptional()
  @IsString()
  ticketId?: string;
}

/** Fills in vendor and cost on a record opened automatically by a return. */
export class UpdateMaintenanceDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  vendor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  vendorContact?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  expectedOn?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  estimatedCost?: number | null;
}

export class CompleteMaintenanceDto {
  @IsIn(['repaired', 'beyond_repair'])
  outcome!: 'repaired' | 'beyond_repair';

  @IsOptional()
  @IsDateString({ strict: true })
  completedOn?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  cost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  vendor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(ISSUE_FIELDS_LIMIT)
  outcomeNotes?: string;
}
