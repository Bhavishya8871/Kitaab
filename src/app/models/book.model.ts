export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  isbn: string;
  description?: string;
  imageUrl: string;
  availableCopies: number;
  totalCopies: number;
  rating?: number;
  publishYear?: number;
  isAvailable: boolean;
  createdAt?: string;
  updatedAt?: string;
  borrowedBy?: string[];
  returnDate?: string;
  dueDate?: string;
}

export interface BookFormData {
  title: string;
  author: string;
  category: string;
  isbn: string;
  description?: string;
  totalCopies: number;
  publishYear?: number;
  imageFile?: File;
}

export interface PopularBook extends Book {
  borrowCount: number;
  averageRating: number;
}

export interface SearchCriteria {
  author?: string;
  title?: string;
  category?: string;
  bookId?: string;
  availability?: 'all' | 'available' | 'unavailable';
  minRating?: number;
  publishYear?: number;
}

export interface SearchResult {
  books: Book[];
  totalCount: number;
  searchTerm: string;
  totalPages?: number;
  currentPage?: number;
  pageSize?: number;
}

export interface BookCategory {
  id: string;
  name: string;
  count: number;
}

export interface BorrowItem {
  bookId: string;
  quantity: number;
  book?: Book;
}

export interface BorrowRequest {
  memberId: string;
  borrowItems: BorrowItem[];
  borrowDate: Date;
  dueDate: Date;
  notes?: string;
}

export interface BorrowResponse {
  success: boolean;
  message: string;
  borrowId?: string;
  dueDate?: string;
  borrowedBooks?: BorrowItem[];
  fineAmount?: number;
}

export interface BookBorrower {
  memberId: string;
  memberName: string;
  borrowDate: string;
  dueDate: string;
  returnDate?: string;
  quantity: number;
  isOverdue?: boolean;
  fineAmount?: number;
}

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface BookFilter {
  search?: string;
  category?: string;
  availability?: 'all' | 'available' | 'unavailable';
  author?: string;
  minRating?: number;
  maxRating?: number;
  publishYearFrom?: number;
  publishYearTo?: number;
}
