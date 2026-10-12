import { SetMetadata } from '@nestjs/common';
import { UserType } from '../../generated/prisma/client.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserType[]) => SetMetadata(ROLES_KEY, roles);
