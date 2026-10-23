import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const CATEGORIES = ['laptop', 'monitor', 'phone', 'access_card', 'other'] as const;
const STATUSES = ['in_stock', 'assigned', 'repair', 'retired', 'lost'] as const;
const TICKET_TYPES = ['Issue', 'Query', 'Request'] as const;
const TICKET_STATUSES = ['Open', 'InProgress', 'Resolved', 'Closed'] as const;
const RETURN_STATUSES = ['in_stock', 'repair', 'retired'] as const;

export class CreateAssetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  assetTag!: string;

  @IsIn(CATEGORIES)
  category!: (typeof CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  makeModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  serialNo?: string;

  @IsOptional()
  @IsDateString()
  purchasedOn?: string;
}

export class UpdateAssetDto {
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  makeModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  serialNo?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}

export class AssignAssetDto {
  @IsString()
  @MinLength(1)
  employeeId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  conditionNotes?: string;
}

export class ReturnAssetDto {
  @IsIn(RETURN_STATUSES)
  status!: (typeof RETURN_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  conditionNotes?: string;
}

export class CreateAssetTicketDto {
  @IsIn(TICKET_TYPES)
  type!: (typeof TICKET_TYPES)[number];

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class UpdateAssetTicketDto {
  @IsIn(TICKET_STATUSES)
  status!: (typeof TICKET_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
