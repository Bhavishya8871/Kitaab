export interface UserBorrowInfo {
  libraryId: string;
  name: string;
  email: string;
  phone?: string;
  currentBorrowedCount: number;
  maxBooksAllowed: number;
  fines: number;
  overdueBooks: number;
  isEligible: boolean;
  membershipType?: 'BASIC' | 'PREMIUM' | 'STUDENT' | 'FACULTY';
  memberSince?: Date;
  lastBorrowDate?: Date;
  borrowingHistory?: {
    totalBooksBorrowed: number;
    booksThisMonth: number;
    averageBorrowDuration: number;
  };
}

export interface BorrowHistoryEntry {
  id: string;
  bookId: string;
  title: string;
  author: string;
  category: string;
  isbn: string;
  borrowDate: Date;
  dueDate: Date;
  returnedDate?: Date;
  fineAmount: number;
  finePaid: boolean;
  status: BorrowStatus;
  notes?: string;
  renewalCount?: number;
  maxRenewalsAllowed?: number;
  borrowedBy?: string; // Member ID
  issuedBy?: string; // Staff ID who issued the book
  returnedBy?: string; // Staff ID who processed the return
}

export type BorrowStatus = 'Borrowed' | 'Returned' | 'Overdue' | 'Lost' | 'Damaged';

export interface UserProfile {
  memberId: string;
  memberName: string;
  email: string;
  phone?: string;
  address?: string;
  dateOfBirth?: Date;
  membershipType: 'BASIC' | 'PREMIUM' | 'STUDENT' | 'FACULTY';
  memberSince: Date;
  profilePictureUrl?: string;
  preferences?: UserPreferences;
  isActive: boolean;
  lastLogin?: Date;
}

export interface UserPreferences {
  favoriteGenres: string[];
  notificationSettings: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    reminderDaysBeforeDue: number;
    overdueNotifications: boolean;
  };
  privacySettings: {
    showReadingHistory: boolean;
    showFavoriteBooks: boolean;
    allowRecommendations: boolean;
  };
  readingGoals?: {
    monthlyGoal: number;
    yearlyGoal: number;
    currentStreak: number;
  };
}

export interface UserStatistics {
  totalBooksRead: number;
  currentlyBorrowed: number;
  overdueBooks: number;
  totalFines: number;
  averageReadingTime: number; // in days
  favoriteGenres: GenreStatistic[];
  readingStreak: number; // consecutive days/months
  monthlyReadingGoal: number;
  booksReadThisMonth: number;
  yearlyReadingGoal?: number;
  booksReadThisYear?: number;
  memberRanking?: number;
  achievementsUnlocked?: Achievement[];
}

export interface GenreStatistic {
  genre: string;
  booksRead: number;
  percentage: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedDate: Date;
  category: 'READING' | 'PARTICIPATION' | 'MILESTONE' | 'SPECIAL';
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PasswordChangeResponse {
  success: boolean;
  message: string;
}

export interface BorrowSearchRequest {
  memberId?: string;
  status?: BorrowStatus;
  bookTitle?: string;
  author?: string;
  category?: string;
  borrowDateFrom?: string;
  borrowDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  includeReturned?: boolean;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

export interface PaginatedBorrowResponse {
  content: BorrowHistoryEntry[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface BorrowExtensionRequest {
  borrowId: string;
  extensionDays: number;
  reason?: string;
}

export interface BorrowExtensionResponse {
  success: boolean;
  message: string;
  newDueDate?: Date;
  extensionsUsed?: number;
  maxExtensionsAllowed?: number;
}

export interface BookReturnRequest {
  borrowId: string;
  returnDate?: Date;
  condition?: 'GOOD' | 'FAIR' | 'DAMAGED' | 'LOST';
  notes?: string;
}

export interface BookReturnResponse {
  success: boolean;
  message: string;
  returnDate: Date;
  fineAmount?: number;
  needsPayment?: boolean;
}

// Enums for better type safety
export enum BorrowStatusEnum {
  BORROWED = 'Borrowed',
  RETURNED = 'Returned',
  OVERDUE = 'Overdue',
  LOST = 'Lost',
  DAMAGED = 'Damaged'
}

export enum MembershipTypeEnum {
  BASIC = 'BASIC',
  PREMIUM = 'PREMIUM',
  STUDENT = 'STUDENT',
  FACULTY = 'FACULTY'
}

// Validation interfaces
export interface UserValidationErrors {
  memberName?: string[];
  email?: string[];
  phone?: string[];
  password?: string[];
}

// Reading analytics interfaces
export interface ReadingAnalytics {
  dailyReadingTime: DailyReadingTime[];
  monthlyProgress: MonthlyProgress[];
  genreDistribution: GenreDistribution[];
  readingTrends: ReadingTrend[];
}

export interface DailyReadingTime {
  date: Date;
  timeSpent: number; // in minutes
  pagesRead: number;
}

export interface MonthlyProgress {
  month: string;
  year: number;
  booksCompleted: number;
  pagesRead: number;
  averageRating: number;
}

export interface GenreDistribution {
  genre: string;
  count: number;
  percentage: number;
  averageRating: number;
}

export interface ReadingTrend {
  period: string;
  booksRead: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
}
