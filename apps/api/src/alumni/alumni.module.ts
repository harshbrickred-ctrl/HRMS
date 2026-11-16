import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { HrModule } from '../hr/hr.module';
import { RbacModule } from '../rbac/rbac.module';
import { AlumniAdminController } from './alumni-admin.controller';
import { AlumniAuthController } from './alumni-auth.controller';
import { AlumniAuthGuard } from './alumni-auth.guard';
import {
  ALUMNI_ACCESS_TTL,
  ALUMNI_AUDIENCE,
  ALUMNI_ISSUER,
  AlumniAuthService,
  alumniJwtSecret,
} from './alumni-auth.service';
import { AlumniCareersService } from './alumni-careers.service';
import { AlumniDocumentsService } from './alumni-documents.service';
import { AlumniEngagementService } from './alumni-engagement.service';
import { AlumniInvitationsService } from './alumni-invitations.service';
import { AlumniMailService } from './alumni-mail.service';
import { AlumniPortalController } from './alumni-portal.controller';
import { AlumniProfileService } from './alumni-profile.service';
import { AlumniProgramsController } from './alumni-programs.controller';
import { AlumniRecordsService } from './alumni-records.service';
import { AlumniSupport } from './alumni-support.service';

@Module({
  imports: [
    RbacModule,
    // Rehire creates the new employee through the existing HrService.
    HrModule,
    // Its own JwtService and secret; the employee JwtModule in AuthModule is untouched.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: alumniJwtSecret(config),
        signOptions: {
          expiresIn: ALUMNI_ACCESS_TTL,
          audience: ALUMNI_AUDIENCE,
          issuer: ALUMNI_ISSUER,
        },
      }),
    }),
  ],
  controllers: [
    AlumniAuthController,
    AlumniPortalController,
    AlumniAdminController,
    AlumniProgramsController,
  ],
  providers: [
    AlumniSupport,
    AlumniMailService,
    AlumniAuthService,
    AlumniAuthGuard,
    AlumniInvitationsService,
    AlumniRecordsService,
    AlumniProfileService,
    AlumniDocumentsService,
    AlumniEngagementService,
    AlumniCareersService,
  ],
  // A future Exit or F&F module can import this and call createFromExit().
  exports: [AlumniRecordsService],
})
export class AlumniModule {}
