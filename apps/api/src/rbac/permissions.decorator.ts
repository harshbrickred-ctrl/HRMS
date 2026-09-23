import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/** Require all listed permission codes (intersection). */
export const Permissions = (...codes: string[]) =>
  SetMetadata(PERMISSIONS_KEY, codes);
