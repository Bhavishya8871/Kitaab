export interface AuthUser {
  memberId: string;
  memberName: string;
  email: string;
  role?: string;
  membershipDate?: string;
  phone?: string;
  address?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: AuthUser;
  refreshToken?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifySecretRequest {
  email: string;
  answer: string;
}

export interface ResetPasswordRequest {
  email: string;
  newPassword: string;
  resetToken?: string;
}

export interface TokenRefreshResponse {
  token: string;
  refreshToken?: string;
}
