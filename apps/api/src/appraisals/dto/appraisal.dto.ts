import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsIn,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CsvImportDto {
  @IsString() cycleId!: string;
  @IsString() @MaxLength(200) fileName!: string;
  @IsOptional() @IsString() @MaxLength(4000000) csv?: string;
  @IsOptional() @IsString() @MaxLength(6000000) workbookBase64?: string;
}

export class EmployeeAssignmentRowDto {
  @IsString() employeeCode!: string;
  @IsOptional() @IsString() employeeName?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() designation?: string;
  @IsOptional() @IsString() reportingManagerCode?: string;
  @IsIn(['Yes', 'No', 'yes', 'no', 'true', 'false']) include!: string;
}

export class AssignmentPreviewDto {
  @IsIn(['all', 'department', 'designation', 'manager', 'selected', 'excel']) mode!: string;
  @IsOptional() @IsString() filterValue?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10000) @IsString({ each: true }) selectedEmployeeCodes?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(10000) @IsString({ each: true }) excludedEmployeeCodes?: string[];
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10000) @ValidateNested({ each: true }) @Type(() => EmployeeAssignmentRowDto)
  rows?: EmployeeAssignmentRowDto[];
}

export class CycleKpiDto {
  @IsString() @MaxLength(120) title!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(120) subKpiName?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(100) weight!: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(100) subWeight?: number;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class SetCycleKpisDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CycleKpiDto)
  kpis!: CycleKpiDto[];
}

export class CreateCycleDto {
  @IsString() @MaxLength(120) name!: string;
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
  @IsDateString() selfStart!: string;
  @IsDateString() selfDeadline!: string;
  @IsDateString() reviewDeadline!: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CycleKpiDto)
  kpis?: CycleKpiDto[];
}

export class SelfKpiResponseDto {
  @IsString() cycleKpiId!: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) selfRating?: number;
  @IsOptional() @IsString() @MaxLength(3000) selfComment?: string;
}

export class SaveSelfAppraisalDto {
  @IsOptional() @IsArray() goals?: unknown[];
  @IsOptional() @IsArray() achievements?: unknown[];
  @IsOptional() @IsString() @MaxLength(5000) selfFeedback?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SelfKpiResponseDto)
  kpis?: SelfKpiResponseDto[];
}

export class ManagerKpiResponseDto {
  @IsString() cycleKpiId!: string;
  @IsInt() @Min(1) @Max(5) managerRating!: number;
  @IsOptional() @IsString() @MaxLength(3000) managerComment?: string;
}

export class ManagerReviewDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ManagerKpiResponseDto)
  kpis!: ManagerKpiResponseDto[];
  @IsString() @MaxLength(5000) feedback!: string;
  @IsString() @MaxLength(3000) strengths!: string;
  @IsString() @MaxLength(3000) improvementAreas!: string;
  @IsNumber() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(3000) comment?: string;
}

export class HrReviewDto {
  @IsString() @MaxLength(5000) feedback!: string;
  @IsNumber() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(2000) promotionRecommendation?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) salaryIncreasePercent?: number;
  @IsOptional() @IsNumber() @Min(0) salaryIncreaseAmount?: number;
  @IsOptional() @IsString() @MaxLength(3000) comment?: string;
}

export class DecisionDto {
  @IsOptional() @IsString() @MaxLength(5000) comment?: string;
}

export class RevisionDto {
  @IsString() @MaxLength(5000) comment!: string;
}
