export interface Member {
  id: string;
  memberName: string;
  email: string;
  countryCode: string;
  mobileNumber: string;
  address: string;
  dateOfBirth: string;
  isActive?: boolean;
  membershipDate?: string;
  lastLoginDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MemberProfile extends Member {
  borrowedBooksCount?: number;
  totalFines?: number;
  membershipStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  profilePictureUrl?: string;
}

export interface MemberRegistrationRequest {
  memberName: string;
  email: string;
  countryCode: string;
  mobileNumber: string;
  address: string;
  dateOfBirth: string;
  password: string;
  secretQuestion: string;
  secretAnswer: string;
  acceptTerms?: boolean;
}

export interface MemberRegistrationResponse {
  success: boolean;
  message: string;
  memberId?: string;
  memberName?: string;
  email?: string;
  membershipDate?: string;
}

export interface UpdateProfileRequest {
  memberName?: string;
  countryCode?: string;
  mobileNumber?: string;
  address?: string;
  dateOfBirth?: string;
}

export interface CountryCode {
  code: string;
  name: string;
  dialCode: string;
  flag?: string;
}

export interface MemberSearchResult {
  content: Member[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface PasswordUpdateRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface MemberStatistics {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  newMembersThisMonth: number;
  newMembersToday: number;
}

export interface MemberValidationErrors {
  memberName?: string[];
  email?: string[];
  mobileNumber?: string[];
  password?: string[];
  dateOfBirth?: string[];
  address?: string[];
}

export interface MemberActivity {
  memberId: string;
  activity: string;
  timestamp: string;
  details?: string;
}

// Enums for better type safety
export enum MembershipStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED'
}

export enum SecretQuestions {
  FAVORITE_BOOK = "What is your favorite book?",
  FIRST_SCHOOL = "What was the name of your first school?",
  CHILDHOOD_FRIEND = "What was the name of your childhood best friend?",
  FIRST_PET = "What was the name of your first pet?",
  MOTHER_MAIDEN_NAME = "What is your mother's maiden name?",
  BIRTH_CITY = "In which city were you born?"
}
