import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DOCUMENT_TYPES } from './alumni-admin.dto';

// ─── Sign-up and sign-in (public) ────────────────────────────────────────────

export class InvitationTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;
}

export class AlumniRegisterDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;

  @IsString()
  @MaxLength(80)
  password!: string;

  @Equals(true, { message: 'Accept the terms of use to continue.' })
  acceptTerms!: boolean;

  @Equals(true, {
    message: 'Agree to the processing of your data to continue.',
  })
  acceptDataProcessing!: boolean;

  @IsOptional()
  @IsBoolean()
  communications?: boolean;

  @IsOptional()
  @IsBoolean()
  directory?: boolean;
}

export class AlumniLoginDto {
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

export class AlumniRefreshDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  refreshToken!: string;
}

export class AlumniResetRequestDto {
  @IsEmail()
  @MaxLength(160)
  email!: string;
}

export class AlumniResetVerifyDto {
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code.' })
  otp!: string;
}

export class AlumniResetConfirmDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  resetToken!: string;

  @IsString()
  @MaxLength(80)
  password!: string;
}

// ─── Signed-in alumni ────────────────────────────────────────────────────────

export class AlumniChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @MaxLength(80)
  newPassword!: string;
}

export class EmailChangeRequestDto {
  @IsEmail()
  @MaxLength(160)
  newEmail!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

export class EmailChangeConfirmDto {
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code.' })
  otp!: string;
}

export class AlumniProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  currentEmployer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  currentDesignation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @Matches(/^$|^\+?[0-9 ()-]{6,20}$/, {
    message: 'Enter a valid phone number.',
  })
  phone?: string;

  @IsOptional()
  @Matches(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
    message: 'Enter a valid contact email.',
  })
  @MaxLength(160)
  contactEmail?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  skills?: string[];

  @IsOptional()
  @Matches(/^$|^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/[A-Za-z0-9_\-/%.]+$/, {
    message:
      'Use your LinkedIn profile link, starting with https://www.linkedin.com/',
  })
  @MaxLength(200)
  linkedinUrl?: string;

  /** Field key -> visible to other alumni. */
  @IsOptional()
  @IsObject()
  visibility?: Record<string, unknown>;
}

export const PORTAL_CONSENT_TYPES = [
  'communications',
  'directory',
  'data_processing',
] as const;

export class ConsentDto {
  @IsIn(PORTAL_CONSENT_TYPES)
  type!: (typeof PORTAL_CONSENT_TYPES)[number];

  @IsBoolean()
  granted!: boolean;
}

export class DirectoryQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  batch?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  exitYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  industry?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;
}

export class DocumentRequestDto {
  @IsIn(DOCUMENT_TYPES)
  type!: (typeof DOCUMENT_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  period?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}

export class RsvpDto {
  @IsIn(['going', 'maybe', 'declined'])
  response!: 'going' | 'maybe' | 'declined';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ApplyDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

/** Multipart fields that come with an optional CV. */
export class ReferralDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  jobId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  candidateName!: string;

  @IsEmail()
  @MaxLength(160)
  candidateEmail!: string;

  @IsOptional()
  @Matches(/^$|^\+?[0-9 ()-]{6,20}$/, {
    message: 'Enter a valid phone number.',
  })
  candidatePhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  relationship?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
