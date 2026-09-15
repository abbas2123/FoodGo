import { UserStatus, UserType } from '../../../generated/prisma/client.js';

export interface JwtPayload {
  sub: string;
  phone: string;
  type: UserType;
  status: UserStatus;
  iat?: number;
  exp?: number;
}
