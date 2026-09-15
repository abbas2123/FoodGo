export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUser {
  id: string;
  phone: string;
  name: string | null;
  type: string;
  status: string;
}

export interface AuthResponse {
  message: string;
  user: AuthenticatedUser;
  tokens: AuthTokens;
}
