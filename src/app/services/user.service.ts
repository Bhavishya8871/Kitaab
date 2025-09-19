import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, of ,throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { 
  UserBorrowInfo, 
  BorrowHistoryEntry, 
  PasswordChangeRequest, 
  PasswordChangeResponse,
  UserProfile,
  BorrowStatus,
  UserStatistics,
  PaginatedBorrowResponse,
  BorrowSearchRequest
} from '../models/user.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly API_URL = 'http://localhost:8080/api/users';
  private readonly BORROW_URL = 'http://localhost:8080/api/borrows';
  
  // BehaviorSubject for real-time updates
  private borrowHistorySubject = new BehaviorSubject<BorrowHistoryEntry[]>([]);
  public borrowHistory$ = this.borrowHistorySubject.asObservable();

  private userBorrowInfoSubject = new BehaviorSubject<UserBorrowInfo | null>(null);
  public userBorrowInfo$ = this.userBorrowInfoSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Load user data on service initialization
    this.loadUserData();
  }

  // Load user data and update BehaviorSubjects
  private loadUserData(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      // Load user borrow info
      this.getUserBorrowInfo(currentUser.memberId).subscribe({
        next: (borrowInfo) => {
          this.userBorrowInfoSubject.next(borrowInfo);
        },
        error: (error) => {
          console.error('Error loading user borrow info:', error);
          this.userBorrowInfoSubject.next(null);
        }
      });

      // Load borrow history
      this.getUserBorrowHistory(currentUser.memberId).subscribe({
        next: (history) => {
          this.borrowHistorySubject.next(history);
        },
        error: (error) => {
          console.error('Error loading borrow history:', error);
          this.borrowHistorySubject.next([]);
        }
      });
    }
  }

  // Get user's borrowing information
  getUserBorrowInfo(memberId: string): Observable<UserBorrowInfo> {
    const params = new HttpParams().set('memberId', memberId);
    
    return this.http.get<UserBorrowInfo>(`${this.API_URL}/${memberId}/borrow-info`, { params })
      .pipe(
        catchError(error => {
          console.error('Get user borrow info error:', error);
          let errorMessage = 'Failed to load user information.';
          
          if (error.status === 404) {
            errorMessage = 'User not found.';
          } else if (error.status === 403) {
            errorMessage = 'Access denied. Please check your permissions.';
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // Get user's complete profile
  getUserProfile(memberId: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.API_URL}/${memberId}/profile`)
      .pipe(
        catchError(error => {
          console.error('Get user profile error:', error);
          return throwError(() => error);
        })
      );
  }

  // Get user's borrow history with pagination
  getUserBorrowHistory(memberId: string, page: number = 0, size: number = 20): Observable<BorrowHistoryEntry[]> {
    let params = new HttpParams()
      .set('memberId', memberId)
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', 'borrowDate,desc'); // Sort by borrow date descending

    return this.http.get<PaginatedBorrowResponse>(`${this.BORROW_URL}/history`, { params })
      .pipe(
        map(response => response.content.map(entry => ({
          ...entry,
          borrowDate: new Date(entry.borrowDate),
          dueDate: new Date(entry.dueDate),
          returnedDate: entry.returnedDate ? new Date(entry.returnedDate) : undefined
        }))),
        catchError(error => {
          console.error('Get user borrow history error:', error);
          return throwError(() => error);
        })
      );
  }

  // Search borrow history with advanced filters
  searchBorrowHistory(searchRequest: BorrowSearchRequest): Observable<PaginatedBorrowResponse> {
    let params = new HttpParams()
      .set('page', (searchRequest.page || 0).toString())
      .set('size', (searchRequest.size || 20).toString());

    if (searchRequest.memberId) {
      params = params.set('memberId', searchRequest.memberId);
    }
    if (searchRequest.status) {
      params = params.set('status', searchRequest.status);
    }
    if (searchRequest.bookTitle) {
      params = params.set('bookTitle', searchRequest.bookTitle);
    }
    if (searchRequest.author) {
      params = params.set('author', searchRequest.author);
    }
    if (searchRequest.borrowDateFrom) {
      params = params.set('borrowDateFrom', searchRequest.borrowDateFrom);
    }
    if (searchRequest.borrowDateTo) {
      params = params.set('borrowDateTo', searchRequest.borrowDateTo);
    }
    if (searchRequest.dueDateFrom) {
      params = params.set('dueDateFrom', searchRequest.dueDateFrom);
    }
    if (searchRequest.dueDateTo) {
      params = params.set('dueDateTo', searchRequest.dueDateTo);
    }

    return this.http.get<PaginatedBorrowResponse>(`${this.BORROW_URL}/search`, { params })
      .pipe(
        map(response => ({
          ...response,
          content: response.content.map(entry => ({
            ...entry,
            borrowDate: new Date(entry.borrowDate),
            dueDate: new Date(entry.dueDate),
            returnedDate: entry.returnedDate ? new Date(entry.returnedDate) : undefined
          }))
        })),
        catchError(error => {
          console.error('Search borrow history error:', error);
          return throwError(() => error);
        })
      );
  }

  // Get user statistics
  // Get user statistics
getUserStatistics(memberId: string): Observable<UserStatistics> {
  const params = new HttpParams().set('memberId', memberId);

  return this.http.get<UserStatistics>(`${this.API_URL}/${memberId}/statistics`, { params })
    .pipe(
      catchError(error => {
        console.error('Get user statistics error:', error);
        // Return default statistics with proper typing
        const defaultStats: UserStatistics = {
          totalBooksRead: 0,
          currentlyBorrowed: 0,
          overdueBooks: 0,
          totalFines: 0,
          averageReadingTime: 0,
          favoriteGenres: [],
          readingStreak: 0,
          monthlyReadingGoal: 0,
          booksReadThisMonth: 0,
          yearlyReadingGoal: 0,
          booksReadThisYear: 0,
          memberRanking: 0,
          achievementsUnlocked: []
        };
        return of(defaultStats);
      })
    );
}


  // Update user's borrow count (internal method)
  updateUserBorrowCount(memberId: string, increment: number): Observable<{ success: boolean; newCount: number }> {
    return this.http.patch<{ success: boolean; newCount: number }>(`${this.API_URL}/${memberId}/borrow-count`, {
      increment
    }).pipe(
      tap(response => {
        if (response.success) {
          // Refresh user borrow info
          this.refreshUserBorrowInfo(memberId);
          console.log(`✅ User borrow count updated: ${response.newCount}`);
        }
      }),
      catchError(error => {
        console.error('Update borrow count error:', error);
        return throwError(() => error);
      })
    );
  }

  // Change user password
  changePassword(memberId: string, passwordData: PasswordChangeRequest): Observable<PasswordChangeResponse> {
    return this.http.put<PasswordChangeResponse>(`${this.API_URL}/${memberId}/password`, passwordData)
      .pipe(
        catchError(error => {
          console.error('Change password error:', error);
          let errorMessage = 'Failed to change password. Please try again.';
          
          if (error.status === 400) {
            errorMessage = error.error?.message || 'Current password is incorrect.';
          } else if (error.status === 422) {
            errorMessage = 'Password validation failed. Please check requirements.';
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // Update user profile
  updateUserProfile(memberId: string, profileData: Partial<UserProfile>): Observable<UserProfile> {
    return this.http.put<UserProfile>(`${this.API_URL}/${memberId}/profile`, profileData)
      .pipe(
        tap(updatedProfile => {
          console.log('✅ User profile updated:', updatedProfile);
        }),
        catchError(error => {
          console.error('Update profile error:', error);
          let errorMessage = 'Failed to update profile. Please try again.';
          
          if (error.status === 400) {
            errorMessage = error.error?.message || 'Invalid profile data.';
          } else if (error.status === 409) {
            errorMessage = 'Email or phone number already exists.';
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // Extend book due date (if allowed)
  extendBookDueDate(borrowId: string, extensionDays: number = 7): Observable<{ success: boolean; newDueDate: string; message: string }> {
    return this.http.patch<{ success: boolean; newDueDate: string; message: string }>(`${this.BORROW_URL}/${borrowId}/extend`, {
      extensionDays
    }).pipe(
      tap(response => {
        if (response.success) {
          // Refresh borrow history
          const currentUser = this.authService.getCurrentUser();
          if (currentUser) {
            this.refreshBorrowHistory(currentUser.memberId);
          }
          console.log('✅ Book due date extended:', response.newDueDate);
        }
      }),
      catchError(error => {
        console.error('Extend due date error:', error);
        let errorMessage = 'Failed to extend due date. Please try again.';
        
        if (error.status === 400) {
          errorMessage = error.error?.message || 'Extension not allowed for this book.';
        } else if (error.status === 409) {
          errorMessage = 'Book has already been extended or is overdue.';
        }
        
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  // Return book early
  returnBook(borrowId: string, notes?: string): Observable<{ success: boolean; message: string; returnDate: string }> {
    return this.http.patch<{ success: boolean; message: string; returnDate: string }>(`${this.BORROW_URL}/${borrowId}/return`, {
      notes
    }).pipe(
      tap(response => {
        if (response.success) {
          // Refresh user data
          const currentUser = this.authService.getCurrentUser();
          if (currentUser) {
            this.refreshUserBorrowInfo(currentUser.memberId);
            this.refreshBorrowHistory(currentUser.memberId);
          }
          console.log('✅ Book returned:', response.returnDate);
        }
      }),
      catchError(error => {
        console.error('Return book error:', error);
        let errorMessage = 'Failed to return book. Please try again.';
        
        if (error.status === 400) {
          errorMessage = error.error?.message || 'Book cannot be returned at this time.';
        } else if (error.status === 404) {
          errorMessage = 'Borrow record not found.';
        }
        
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  // Get overdue books for user
  getOverdueBooks(memberId: string): Observable<BorrowHistoryEntry[]> {
    const params = new HttpParams()
      .set('memberId', memberId)
      .set('status', 'OVERDUE');

    return this.http.get<BorrowHistoryEntry[]>(`${this.BORROW_URL}/overdue`, { params })
      .pipe(
        map(entries => entries.map(entry => ({
          ...entry,
          borrowDate: new Date(entry.borrowDate),
          dueDate: new Date(entry.dueDate),
          returnedDate: entry.returnedDate ? new Date(entry.returnedDate) : undefined
        }))),
        catchError(error => {
          console.error('Get overdue books error:', error);
          return throwError(() => error);
        })
      );
  }

  // Export user data (for GDPR compliance)
  exportUserData(memberId: string, format: 'JSON' | 'PDF' | 'CSV' = 'JSON'): Observable<Blob> {
    const params = new HttpParams()
      .set('memberId', memberId)
      .set('format', format);

    return this.http.get(`${this.API_URL}/${memberId}/export`, { 
      params,
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        console.error('Export user data error:', error);
        return throwError(() => error);
      })
    );
  }

  // Refresh user borrow info
  private refreshUserBorrowInfo(memberId: string): void {
    this.getUserBorrowInfo(memberId).subscribe({
      next: (borrowInfo) => {
        this.userBorrowInfoSubject.next(borrowInfo);
      },
      error: (error) => {
        console.error('Error refreshing user borrow info:', error);
      }
    });
  }

  // Refresh borrow history
  private refreshBorrowHistory(memberId: string): void {
    this.getUserBorrowHistory(memberId).subscribe({
      next: (history) => {
        this.borrowHistorySubject.next(history);
      },
      error: (error) => {
        console.error('Error refreshing borrow history:', error);
      }
    });
  }

  // Manual refresh for all user data
  refreshUserData(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.refreshUserBorrowInfo(currentUser.memberId);
      this.refreshBorrowHistory(currentUser.memberId);
    }
  }

  // Get current user borrow info from BehaviorSubject
  getCurrentUserBorrowInfo(): UserBorrowInfo | null {
    return this.userBorrowInfoSubject.value;
  }

  // Get current borrow history from BehaviorSubject
  getCurrentBorrowHistory(): BorrowHistoryEntry[] {
    return this.borrowHistorySubject.value;
  }

  // Calculate reading statistics
  calculateReadingStats(history: BorrowHistoryEntry[]): {
    averageReadingTime: number;
    booksPerMonth: number;
    favoriteGenre: string;
    completionRate: number;
  } {
    const returnedBooks = history.filter(entry => entry.status === 'Returned');
    
    if (returnedBooks.length === 0) {
      return {
        averageReadingTime: 0,
        booksPerMonth: 0,
        favoriteGenre: 'None',
        completionRate: 0
      };
    }

    // Calculate average reading time
    const totalReadingDays = returnedBooks.reduce((total, entry) => {
      if (entry.returnedDate) {
        const days = Math.ceil(
          (entry.returnedDate.getTime() - entry.borrowDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return total + days;
      }
      return total;
    }, 0);

    const averageReadingTime = Math.round(totalReadingDays / returnedBooks.length);

    // Calculate books per month (based on last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const recentBooks = returnedBooks.filter(entry => 
      entry.borrowDate >= twelveMonthsAgo
    );
    const booksPerMonth = Math.round(recentBooks.length / 12 * 10) / 10;

    // Find favorite genre
    const genreCounts: { [key: string]: number } = {};
    returnedBooks.forEach(entry => {
      const genre = entry.category || 'Uncategorized';
      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    });

    const favoriteGenre = Object.entries(genreCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None';

    // Calculate completion rate
    const completionRate = Math.round(
      (returnedBooks.length / history.length) * 100
    );

    return {
      averageReadingTime,
      booksPerMonth,
      favoriteGenre,
      completionRate
    };
  }
}
