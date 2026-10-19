import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  category!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class UpdateTicketStatusDto {
  @IsIn(['Open', 'InProgress', 'Resolved', 'Closed'])
  status!: 'Open' | 'InProgress' | 'Resolved' | 'Closed';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
