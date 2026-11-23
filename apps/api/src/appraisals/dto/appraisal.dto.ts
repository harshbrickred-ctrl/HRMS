import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateCycleDto {
  @IsString() @MaxLength(120) name!: string;
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
  @IsDateString() selfStart!: string;
  @IsDateString() selfDeadline!: string;
  @IsDateString() reviewDeadline!: string;
}

export class CycleKpiDto {
  @IsString() @MaxLength(120) title!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsNumber() @Min(0.001) @Max(100) weight!: number;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class SetCycleKpisDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CycleKpiDto)
  kpis!: CycleKpiDto[];
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
