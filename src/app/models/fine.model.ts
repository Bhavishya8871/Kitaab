export interface FineRecord {
  id: string;
  memberId: string;
  memberName: string;
  bookId: string;
  bookTitle: string;
  author: string;
  borrowId: string;
  dueDate: Date;
  returnDate?: Date;
  daysOverdue: number;
  dailyFine: number;
  totalFine: number;
  status: FineStatus;
  calculatedDate: Date;
  paidDate?: Date;
  paymentId?: string;
  adminNotes?: string;
  isWaived?: boolean;
  waivedBy?: string;
  waivedReason?: string;
}

export type FineStatus = 'PENDING' | 'PAID' | 'WAIVED' | 'OVERDUE';

export interface PaymentRecord {
  id: string;
  paymentId: string;
  transactionId: string;
  memberId: string;
  memberName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  paymentDate: Date;
  fineRecords: FineRecord[];
  gatewayResponse?: PaymentGatewayResponse;
  processingFee?: number;
  refundId?: string;
  refundAmount?: number;
  refundDate?: Date;
}

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';

export type PaymentMethod = 'card' | 'upi' | 'netbanking' | 'wallet' | 'cash';

export interface PaymentMethodInfo {
  id: PaymentMethod;
  name: string;
  description: string;
  icon: string;
  processingTime: string;
  isEnabled: boolean;
  fees?: number;
  minAmount?: number;
  maxAmount?: number;
}

export interface PaymentRequest {
  memberId: string;
  fineIds: string[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  customerInfo: {
    name: string;
    email: string;
    phone?: string;
  };
  returnUrl?: string;
  webhookUrl?: string;
}

export interface PaymentResponse {
  success: boolean;
  message: string;
  paymentId?: string;
  transactionId?: string;
  gatewayUrl?: string;
  qrCode?: string;
  upiDeepLink?: string;
  estimatedProcessingTime?: string;
}

export interface DummyPaymentForm {
  paymentMethod: PaymentMethod;
  // Card fields
  cardNumber?: string;
  cardName?: string;
  expiryMonth?: string;
  expiryYear?: string;
  cvv?: string;
  // UPI field
  upiId?: string;
  // Net banking
  bankName?: string;
  // Wallet
  walletProvider?: string;
  walletNumber?: string;
}

export interface PaymentGatewayResponse {
  gatewayTransactionId: string;
  gatewayName: string;
  responseCode: string;
  responseMessage: string;
  processedAt: Date;
  fees?: number;
}

export interface FineStatistics {
  totalOutstandingFines: number;
  totalOverdueBooks: number;
  totalPaidFines: number;
  totalWaivedFines?: number;
  averageDaysOverdue: number;
  averageFineAmount?: number;
  finesByMonth: MonthlyFineData[];
  paymentHistory: PaymentSummary[];
  finesByCategory?: { [key: string]: number };
}

export interface MonthlyFineData {
  month: string;
  year: number;
  totalFines: number;
  totalPaid: number;
  totalWaived: number;
  averageDaysOverdue: number;
}

export interface PaymentSummary {
  date: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  bookCount: number;
}

export interface FineSearchRequest {
  memberId?: string;
  status?: FineStatus;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  bookTitle?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

export interface PaginatedFineResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface FineCalculationRule {
  id: string;
  name: string;
  description: string;
  dailyFineAmount: number;
  gracePeriodDays: number;
  maxFineAmount?: number;
  isActive: boolean;
  applicableFrom: Date;
  applicableTo?: Date;
}

export interface FineWaiverRequest {
  fineIds: string[];
  reason: string;
  requestedBy: string;
  supportingDocuments?: string[];
}

export interface FineWaiverResponse {
  success: boolean;
  message: string;
  waivedFines: string[];
  totalWaivedAmount: number;
  approvedBy?: string;
  approvalDate?: Date;
}

// Enums for better type safety
export enum FineStatusEnum {
  PENDING = 'PENDING',
  PAID = 'PAID',
  WAIVED = 'WAIVED',
  OVERDUE = 'OVERDUE'
}

export enum PaymentStatusEnum {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentMethodEnum {
  CARD = 'card',
  UPI = 'upi',
  NETBANKING = 'netbanking',
  WALLET = 'wallet',
  CASH = 'cash'
}

// Validation interfaces
export interface FineValidationErrors {
  memberId?: string[];
  amount?: string[];
  paymentMethod?: string[];
  fineIds?: string[];
}

export interface PaymentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// Admin interfaces
export interface FineReport {
  reportId: string;
  generatedBy: string;
  generatedDate: Date;
  reportType: 'MONTHLY' | 'YEARLY' | 'CUSTOM';
  dateRange: {
    from: Date;
    to: Date;
  };
  totalFines: number;
  totalCollected: number;
  totalWaived: number;
  outstandingAmount: number;
  memberStatistics: MemberFineStatistics[];
}

export interface MemberFineStatistics {
  memberId: string;
  memberName: string;
  totalFines: number;
  totalPaid: number;
  totalWaived: number;
  outstandingAmount: number;
  overdueBooks: number;
  averageDaysOverdue: number;
}
