export interface Complaint {
  id: string;
  memberId: string;
  memberName: string;
  category: ComplaintCategory;
  title: string;
  description: string;
  contactPreference: ContactPreference;
  submissionDate: Date;
  status: ComplaintStatus;
  supportResponse?: string;
  resolutionNotes?: string;
  lastUpdated: Date;
  assignedTo?: string;
  priority: ComplaintPriority;
  responses?: ComplaintResponseEntry[];
  estimatedResolutionDate?: Date;
  actualResolutionDate?: Date;
  customerSatisfactionRating?: number;
  isEscalated?: boolean;
  escalationReason?: string;
  attachments?: ComplaintAttachment[];
}

export interface ComplaintResponseEntry {
  id: string;
  responderId: string;
  responderName: string;
  responderType: 'MEMBER' | 'STAFF' | 'ADMIN';
  message: string;
  timestamp: Date;
  isInternal?: boolean;
}

export interface ComplaintAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadDate: Date;
  downloadUrl: string;
}

export type ComplaintCategory = 
  | 'Library Service'
  | 'Borrowing Process'
  | 'Payment Issues'
  | 'Book Condition'
  | 'Staff Behavior'
  | 'System Technical'
  | 'Facility Issues'
  | 'Other';

export type ContactPreference = 'Email' | 'Phone' | 'SMS';

export type ComplaintStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed' | 'Escalated';

export type ComplaintPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface ComplaintFormData {
  category: ComplaintCategory | '';
  title: string;
  description: string;
  contactPreference: ContactPreference | '';
  attachments?: File[];
}

export interface ComplaintResponse {
  success: boolean;
  complaintId?: string;
  message: string;
  complaint?: Complaint;
}

export interface ComplaintListResponse {
  complaints: Complaint[];
  totalCount: number;
  totalPages?: number;
  currentPage?: number;
  pageSize?: number;
}

export interface ComplaintAction {
  action: 'confirm_resolution' | 'reopen' | 'close' | 'escalate' | 'provide_feedback';
  complaintId: string;
  notes?: string;
  rating?: number; // For customer satisfaction
}

export interface ComplaintSearchRequest {
  query?: string;
  category?: ComplaintCategory;
  status?: ComplaintStatus;
  priority?: ComplaintPriority;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

export interface PaginatedComplaintResponse {
  content: Complaint[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface ComplaintStatistics {
  totalComplaints: number;
  openComplaints: number;
  inProgressComplaints: number;
  resolvedComplaints: number;
  closedComplaints: number;
  escalatedComplaints?: number;
  averageResolutionTime: number; // in hours
  averageCustomerSatisfaction?: number;
  complaintsByCategory: { [key in ComplaintCategory]?: number };
  complaintsByPriority: { [key in ComplaintPriority]?: number };
  resolutionRate?: number; // percentage
  monthlyTrend?: MonthlyComplaintTrend[];
}

export interface MonthlyComplaintTrend {
  month: string;
  year: number;
  totalComplaints: number;
  resolvedComplaints: number;
  averageResolutionTime: number;
}

export interface ComplaintEscalation {
  complaintId: string;
  reason: string;
  escalatedBy: string;
  escalatedTo: string;
  escalationDate: Date;
  notes?: string;
}

export interface ComplaintTemplate {
  id: string;
  title: string;
  category: ComplaintCategory;
  description: string;
  isActive: boolean;
  createdBy: string;
  createdDate: Date;
}

// Enums for better type safety
export enum ComplaintStatusEnum {
  OPEN = 'Open',
  IN_PROGRESS = 'In Progress',
  RESOLVED = 'Resolved',
  CLOSED = 'Closed',
  ESCALATED = 'Escalated'
}

export enum ComplaintPriorityEnum {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export enum ComplaintCategoryEnum {
  LIBRARY_SERVICE = 'Library Service',
  BORROWING_PROCESS = 'Borrowing Process',
  PAYMENT_ISSUES = 'Payment Issues',
  BOOK_CONDITION = 'Book Condition',
  STAFF_BEHAVIOR = 'Staff Behavior',
  SYSTEM_TECHNICAL = 'System Technical',
  FACILITY_ISSUES = 'Facility Issues',
  OTHER = 'Other'
}

// Validation interfaces
export interface ComplaintValidationErrors {
  category?: string[];
  title?: string[];
  description?: string[];
  contactPreference?: string[];
}

export interface ComplaintFilters {
  categories: ComplaintCategory[];
  statuses: ComplaintStatus[];
  priorities: ComplaintPriority[];
  dateRange: {
    start?: Date;
    end?: Date;
  };
  assignedTo?: string[];
}
