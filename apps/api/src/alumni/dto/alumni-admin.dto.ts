import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const ELIGIBILITIES = [
  'eligible',
  'not_eligible',
  'do_not_contact',
] as const;
export const DOCUMENT_TYPES = [
  'experience_letter',
  'relieving_letter',
  'payslip',
  'form16',
  'fnf_statement',
  'pf_details',
  'other',
] as const;
export const ACCESS_STATUSES = [
  'not_invited',
  'invited',
  'invite_expired',
  'registered',
  'revoked',
  'withdrawn',
] as const;
export const REQUEST_STATUSES = [
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'issued',
  'cancelled',
] as const;
export const POST_KINDS = ['announcement', 'newsletter'] as const;
export const JOB_STATUSES = ['draft', 'open', 'closed'] as const;
export const HR_APPLICATION_STATUSES = [
  'shortlisted',
  'interviewing',
  'offered',
  'rejected',
] as const;
export const APPLICATION_STATUSES = [
  'applied',
  'shortlisted',
  'interviewing',
  'offered',
  'rehired',
  'rejected',
  'withdrawn',
] as const;
export const REFERRAL_STATUSES = [
  'submitted',
  'screening',
  'interviewing',
  'offered',
  'hired',
  'rejected',
  'withdrawn',
] as const;
export const REWARD_STATUSES = [
  'not_applicable',
  'pending',
  'approved',
  'paid',
  'cancelled',
] as const;

// ─── Exit closure and alumni records ─────────────────────────────────────────

export class CreateExitClosureDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  employeeId!: string;

  @IsDateString()
  joiningDate!: string;

  @IsDateString()
  lastWorkingDay!: string;

  @IsEmail()
  @MaxLength(160)
  personalEmail!: string;

  @IsOptional()
  @IsDateString()
  exitCompletedOn?: string;

  @IsOptional()
  @IsDateString()
  fnfSettledOn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fnfReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateExitClosureDto {
  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @IsOptional()
  @IsDateString()
  lastWorkingDay?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  personalEmail?: string;

  @IsOptional()
  @IsDateString()
  exitCompletedOn?: string;

  @IsOptional()
  @IsDateString()
  fnfSettledOn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fnfReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class AlumniListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn(ELIGIBILITIES)
  eligibility?: (typeof ELIGIBILITIES)[number];

  @IsOptional()
  @IsIn(ACCESS_STATUSES)
  access?: (typeof ACCESS_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  exitYear?: number;
}

export class UpdateAlumniRecordDto {
  @IsEmail()
  @MaxLength(160)
  personalEmail!: string;
}

export class EligibilityDto {
  @IsIn(ELIGIBILITIES)
  eligibility!: (typeof ELIGIBILITIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class InviteManyDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  alumniIds!: string[];
}

// ─── Documents ────────────────────────────────────────────────────────────────

/** Multipart fields that come with an uploaded document. */
export class UploadAlumniDocumentDto {
  @IsIn(DOCUMENT_TYPES)
  type!: (typeof DOCUMENT_TYPES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  period?: string;
}

export class RequestListQueryDto {
  @IsOptional()
  @IsIn(REQUEST_STATUSES)
  status?: (typeof REQUEST_STATUSES)[number];
}

export class RequestDecisionDto {
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class IssueRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  period?: string;
}

// ─── Announcements and events ────────────────────────────────────────────────

export class AudienceDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  departments?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @Min(1950, { each: true })
  @Max(2100, { each: true })
  exitYears?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @Min(1950, { each: true })
  @Max(2100, { each: true })
  joinYears?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  locations?: string[];
}

export class AnnouncementDto {
  @IsOptional()
  @IsIn(POST_KINDS)
  kind?: (typeof POST_KINDS)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AudienceDto)
  audience?: AudienceDto;
}

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsIn(POST_KINDS)
  kind?: (typeof POST_KINDS)[number];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AudienceDto)
  audience?: AudienceDto;
}

const URL_OPTIONS = { require_protocol: true, protocols: ['https', 'http'] };

export class EventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  venue?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(500)
  meetingUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  capacity?: number;

  @IsOptional()
  @IsDateString()
  rsvpBy?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AudienceDto)
  audience?: AudienceDto;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  venue?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(500)
  meetingUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  capacity?: number;

  @IsOptional()
  @IsDateString()
  rsvpBy?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AudienceDto)
  audience?: AudienceDto;
}

// ─── Job board, rehire and referrals ─────────────────────────────────────────

export class JobDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  departmentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  employmentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  experience?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  description!: string;

  @IsOptional()
  @IsDateString()
  closesOn?: string;
}

export class UpdateJobDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  departmentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  employmentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  experience?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsDateString()
  closesOn?: string;
}

export class JobStatusDto {
  @IsIn(JOB_STATUSES)
  status!: (typeof JOB_STATUSES)[number];
}

export class ApplicationListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  jobId?: string;

  @IsOptional()
  @IsIn(APPLICATION_STATUSES)
  status?: (typeof APPLICATION_STATUSES)[number];
}

export class ApplicationStatusDto {
  @IsIn(HR_APPLICATION_STATUSES)
  status!: (typeof HR_APPLICATION_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class StartRehireDto {
  @IsDateString()
  joiningDate!: string;

  @IsEmail()
  @MaxLength(120)
  workEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  designation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  locationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

/** What HrService.createEmployee needs on top of the rehire record. */
export class CompleteRehireDto {
  @IsString()
  @MinLength(8)
  @MaxLength(80)
  password!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  roleCodes!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  teamId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  managerId?: string;
}

export class CancelDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReferralListQueryDto {
  @IsOptional()
  @IsIn(REFERRAL_STATUSES)
  status?: (typeof REFERRAL_STATUSES)[number];
}

export class UpdateReferralDto {
  @IsOptional()
  @IsIn(REFERRAL_STATUSES)
  status?: (typeof REFERRAL_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  hrNote?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  rewardAmount?: number;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/, {
    message: 'Currency must be a 3-letter code such as INR.',
  })
  rewardCurrency?: string;

  @IsOptional()
  @IsIn(REWARD_STATUSES)
  rewardStatus?: (typeof REWARD_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  rewardPaidOn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  rewardReference?: string;
}
