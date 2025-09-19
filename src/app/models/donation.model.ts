export interface Donation {
  id: string;
  memberId: string;
  memberName: string;
  title: string;
  author: string;
  condition: DonationConditionValue;
  quantity: number;
  photoUrl?: string;
  notes?: string;
  submissionDate: Date;
  status: DonationStatus;
  adminNotes?: string;
  statusUpdatedDate?: Date;
  reviewedBy?: string;
  estimatedValue?: number;
  libraryCategory?: string;
  isAddedToLibrary?: boolean;
  libraryBookId?: string;
}

export type DonationStatus = 'Pending' | 'Accepted' | 'Rejected' | 'Under Review';

export type DonationConditionValue = 'New' | 'Like New' | 'Good' | 'Fair' | 'Poor';

export interface DonationCondition {
  value: DonationConditionValue;
  label: string;
  description: string;
}

export interface DonationFormData {
  title: string;
  author: string;
  condition: DonationConditionValue;
  quantity: number;
  notes?: string;
  photoFile?: File;
}

export interface DonationResponse {
  success: boolean;
  donationId?: string;
  message: string;
  donation?: Donation;
}

export interface DonationListResponse {
  donations: Donation[];
  totalCount: number;
  totalPages?: number;
  currentPage?: number;
  pageSize?: number;
}

export interface PaginatedDonationResponse {
  content: Donation[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface DonationSearchRequest {
  query?: string;
  status?: DonationStatus;
  condition?: DonationConditionValue;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

export interface DonationStatistics {
  totalDonations: number;
  pendingDonations: number;
  acceptedDonations: number;
  rejectedDonations: number;
  underReviewDonations?: number;
  totalBooksAddedToLibrary?: number;
  donationsByCondition: { [key in DonationConditionValue]?: number };
  donationsByMonth: MonthlyDonationTrend[];
  averageProcessingTime?: number; // in days
  acceptanceRate?: number; // percentage
}

export interface MonthlyDonationTrend {
  month: string;
  year: number;
  totalDonations: number;
  acceptedDonations: number;
  rejectedDonations: number;
}

export interface DonationFilter {
  statuses: DonationStatus[];
  conditions: DonationConditionValue[];
  dateRange: {
    start?: Date;
    end?: Date;
  };
  searchQuery?: string;
  memberId?: string;
}

// Enums for better type safety
export enum DonationStatusEnum {
  PENDING = 'Pending',
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected',
  UNDER_REVIEW = 'Under Review'
}

export enum DonationConditionEnum {
  NEW = 'New',
  LIKE_NEW = 'Like New',
  GOOD = 'Good',
  FAIR = 'Fair',
  POOR = 'Poor'
}

// Validation interfaces
export interface DonationValidationErrors {
  title?: string[];
  author?: string[];
  condition?: string[];
  quantity?: string[];
  photo?: string[];
  notes?: string[];
}

// Admin interfaces
export interface DonationReview {
  donationId: string;
  reviewerId: string;
  reviewerName: string;
  status: DonationStatus;
  adminNotes: string;
  estimatedValue?: number;
  libraryCategory?: string;
  reviewDate: Date;
}

export interface DonationApproval {
  donationId: string;
  approvedBy: string;
  approvalDate: Date;
  libraryBookId?: string;
  addedToLibrary: boolean;
  notes?: string;
}
