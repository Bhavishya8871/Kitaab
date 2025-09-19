import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { UserBorrowInfo, BorrowHistoryEntry, UserStatistics } from '../models/user.model';
import { AuthUser } from '../models/auth.model';

interface UserData {
  user: AuthUser | null;
  borrowInfo: UserBorrowInfo | null;
  borrowHistory: BorrowHistoryEntry[];
  statistics: UserStatistics | null;
  isLoading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class UserDataService {
  private userDataSubject = new BehaviorSubject<UserData>({
    user: null,
    borrowInfo: null,
    borrowHistory: [],
    statistics: null,
    isLoading: false,
    error: null
  });
  public userData$ = this.userDataSubject.asObservable();

  constructor(
    private authService: AuthService,
    private userService: UserService
  ) {
    this.initializeUserData();
  }

  private initializeUserData(): void {
    // Subscribe to auth user changes
    this.authService.currentUser$.subscribe(user => {
      this.updateUserData({ ...this.userDataSubject.value, user });
      
      if (user) {
        this.loadCompleteUserData(user.memberId);
      } else {
        this.clearUserData();
      }
    });

    // Subscribe to real-time updates from UserService
    this.userService.userBorrowInfo$.subscribe(borrowInfo => {
      this.updateUserData({ 
        ...this.userDataSubject.value, 
        borrowInfo,
        isLoading: false 
      });
    });

    this.userService.borrowHistory$.subscribe(borrowHistory => {
      this.updateUserData({ 
        ...this.userDataSubject.value, 
        borrowHistory,
        isLoading: false 
      });
    });
  }

  private loadCompleteUserData(memberId: string): void {
    this.updateUserData({ 
      ...this.userDataSubject.value, 
      isLoading: true, 
      error: null 
    });

    // Load user statistics
    this.userService.getUserStatistics(memberId).subscribe({
      next: (statistics) => {
        this.updateUserData({
          ...this.userDataSubject.value,
          statistics,
          isLoading: false
        });
      },
      error: (error) => {
        console.error('Error loading user statistics:', error);
        this.updateUserData({
          ...this.userDataSubject.value,
          isLoading: false,
          error: 'Failed to load user statistics'
        });
      }
    });
  }

  private updateUserData(data: UserData): void {
    this.userDataSubject.next(data);
  }

  private clearUserData(): void {
    this.updateUserData({
      user: null,
      borrowInfo: null,
      borrowHistory: [],
      statistics: null,
      isLoading: false,
      error: null
    });
  }

  // Public methods for manual data refresh
  public refreshUserData(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.memberId) {
      this.userService.refreshUserData();
      this.loadCompleteUserData(currentUser.memberId);
      
      // Dispatch custom event for components that need to refresh
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('refresh-user-data', {
          detail: { memberId: currentUser.memberId }
        }));
      }, 500);
    }
  }

  public refreshBorrowInfo(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.memberId) {
      this.updateUserData({ 
        ...this.userDataSubject.value, 
        isLoading: true 
      });
      
      this.userService.getUserBorrowInfo(currentUser.memberId).subscribe({
        next: (borrowInfo) => {
          this.updateUserData({
            ...this.userDataSubject.value,
            borrowInfo,
            isLoading: false
          });
        },
        error: (error) => {
          console.error('Error refreshing borrow info:', error);
          this.updateUserData({
            ...this.userDataSubject.value,
            isLoading: false,
            error: 'Failed to refresh borrow information'
          });
        }
      });
    }
  }

  public refreshBorrowHistory(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.memberId) {
      this.userService.getUserBorrowHistory(currentUser.memberId).subscribe({
        next: (borrowHistory) => {
          this.updateUserData({
            ...this.userDataSubject.value,
            borrowHistory
          });
        },
        error: (error) => {
          console.error('Error refreshing borrow history:', error);
          this.updateUserData({
            ...this.userDataSubject.value,
            error: 'Failed to refresh borrow history'
          });
        }
      });
    }
  }

  // Update specific parts of user data
  updateBorrowInfo(updatedInfo: Partial<UserBorrowInfo>): void {
    const currentData = this.userDataSubject.value;
    if (currentData.borrowInfo) {
      const updated = { ...currentData.borrowInfo, ...updatedInfo };
      this.updateUserData({
        ...currentData,
        borrowInfo: updated
      });
    }
  }

  updateBorrowHistory(updatedHistory: BorrowHistoryEntry[]): void {
    this.updateUserData({
      ...this.userDataSubject.value,
      borrowHistory: updatedHistory
    });
  }

  // Getters for current data
  getCurrentUserData(): UserData {
    return this.userDataSubject.value;
  }

  getCurrentUser(): AuthUser | null {
    return this.userDataSubject.value.user;
  }

  getCurrentBorrowInfo(): UserBorrowInfo | null {
    return this.userDataSubject.value.borrowInfo;
  }

  getCurrentBorrowHistory(): BorrowHistoryEntry[] {
    return this.userDataSubject.value.borrowHistory;
  }

  getCurrentStatistics(): UserStatistics | null {
    return this.userDataSubject.value.statistics;
  }

  // Force complete refresh of all user data
  public forceRefresh(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.memberId) {
      this.clearUserData();
      this.updateUserData({ 
        ...this.userDataSubject.value, 
        user: currentUser,
        isLoading: true 
      });
      this.loadCompleteUserData(currentUser.memberId);
    }
  }

  // Check if user has overdue books
  hasOverdueBooks(): boolean {
    const borrowHistory = this.getCurrentBorrowHistory();
    return borrowHistory.some(entry => entry.status === 'Overdue');
  }

  // Get overdue books count
  getOverdueBooksCount(): number {
    const borrowHistory = this.getCurrentBorrowHistory();
    return borrowHistory.filter(entry => entry.status === 'Overdue').length;
  }

  // Get total fines amount
  getTotalFines(): number {
    const borrowInfo = this.getCurrentBorrowInfo();
    return borrowInfo?.fines || 0;
  }

  // Check if user is eligible to borrow more books
  canBorrowMoreBooks(): boolean {
    const borrowInfo = this.getCurrentBorrowInfo();
    if (!borrowInfo) return false;
    
    return borrowInfo.isEligible && 
           borrowInfo.currentBorrowedCount < borrowInfo.maxBooksAllowed &&
           borrowInfo.fines === 0 &&
           borrowInfo.overdueBooks === 0;
  }

  // Get available borrowing slots
  getAvailableBorrowingSlots(): number {
    const borrowInfo = this.getCurrentBorrowInfo();
    if (!borrowInfo) return 0;
    
    return Math.max(0, borrowInfo.maxBooksAllowed - borrowInfo.currentBorrowedCount);
  }
}
