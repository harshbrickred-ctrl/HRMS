import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const TAX_SECTIONS = ['80C', '80CCD', '80D', '80E', '80G', 'OTHER'] as const;
export type TaxSection = (typeof TAX_SECTIONS)[number];

export class TaxDeclarationLineDto {
  @IsIn([...TAX_SECTIONS])
  section!: TaxSection;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount!: number;
}

export class SaveTaxDeclarationDto {
  @IsString()
  @MinLength(4)
  @MaxLength(12)
  fy!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  rentPaidAnnual!: number;

  @IsBoolean()
  isMetro!: boolean;

  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => TaxDeclarationLineDto)
  lines!: TaxDeclarationLineDto[];
}

export class SubmitTaxDeclarationDto {
  @IsString()
  @MinLength(4)
  @MaxLength(12)
  fy!: string;
}

export class TaxRegimeChangeDto {
  @IsIn(['new', 'old'])
  toRegime!: 'new' | 'old';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class TaxDecisionDto {
  @IsIn(['approved', 'rejected', 'accepted'])
  status!: 'approved' | 'rejected' | 'accepted';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
