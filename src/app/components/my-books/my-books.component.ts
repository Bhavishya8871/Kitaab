import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subscription, debounceTime } from 'rxjs';

// Import jsPDF and related types
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { UserDataService } from '../../services/user-data.service';
import { 
  BorrowHistoryEntry, 
  BorrowStatus, 
  UserBorrowInfo, 
  UserStatistics,
  BorrowSearchRequest 
} from '../../models/user.model';
import { AuthUser } from '../../models/auth.model';
import { NavbarComponent } from '../navbar/navbar.component';

@Component({
  selector: 'app-my-books',
  standalone: true,
  imports: [NavbarComponent, CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './my-books.component.html',
  styleUrls: ['./my-books.component.css']
})
export class MyBooksComponent implements OnInit, OnDestroy {
  filterForm!: FormGroup;
  searchForm!: FormGroup;
  borrowHistory: BorrowHistoryEntry[] = [];
  filteredHistory: BorrowHistoryEntry[] = [];
  currentUser: AuthUser | null = null;
  userBorrowInfo: UserBorrowInfo | null = null;
  userStatistics: UserStatistics | null = null;

  // Pagination
  currentPage = 0;
  pageSize = 20;
  totalPages = 0;
  totalElements = 0;

  // States
  isLoading = false;
  isLoadingMore = false;
  showAdvancedSearch = false;
  errorMessage = '';
  successMessage = '';
  
  // Statistics
  totalBorrowedBooks = 0;
  currentlyBorrowedBooks = 0;
  returnedBooks = 0;
  overdueBooks = 0;
  totalFines = 0;

  readonly FINE_PER_DAY = 5;
  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private authService: AuthService,
    private userDataService: UserDataService,
    private router: Router
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadUserData();
    this.setupSearchAndFilters();
    this.setupEventListeners();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private initializeForms(): void {
    // Filter form
    this.filterForm = this.fb.group({
      startDate: [''],
      endDate: [''],
      status: ['all']
    });

    // Advanced search form
    this.searchForm = this.fb.group({
      query: [''],
      status: [''],
      category: [''],
      author: [''],
      borrowDateFrom: [''],
      borrowDateTo: [''],
      dueDateFrom: [''],
      dueDateTo: [''],
      includeReturned: [true]
    });
  }

  private setupSearchAndFilters(): void {
    // Filter form changes
    this.subscriptions.add(
      this.filterForm.valueChanges.pipe(
        debounceTime(300)
      ).subscribe(() => {
        this.applyFilters();
      })
    );

    // Search form changes
    this.subscriptions.add(
      this.searchForm.valueChanges.pipe(
        debounceTime(500)
      ).subscribe(() => {
        this.performSearch();
      })
    );
  }

  private setupEventListeners(): void {
    // Listen for custom refresh events
    window.addEventListener('refresh-user-data', (event: any) => {
      console.log('🔄 Received refresh event:', event.detail);
      this.refreshData();
    });

    // Listen for storage changes (for localStorage compatibility)
    window.addEventListener('storage', () => {
      console.log('🔄 Storage changed, refreshing data');
      this.refreshData();
    });
  }

  // Load user data using the centralized service
  private loadUserData(): void {
    this.subscriptions.add(
      this.userDataService.userData$.subscribe(userData => {
        console.log('👤 Received user data:', userData);
        
        this.currentUser = userData.user;
        this.userBorrowInfo = userData.borrowInfo;
        this.userStatistics = userData.statistics;
        this.isLoading = userData.isLoading;
        
        if (userData.error) {
          this.errorMessage = userData.error;
        }
        
        // Update borrow history
        this.borrowHistory = userData.borrowHistory;
        this.applyCurrentFilters();
        
        // Update statistics
        this.updateStatistics();
        
        console.log('✅ Updated component data:', {
          historyCount: this.borrowHistory.length,
          borrowInfo: this.userBorrowInfo,
          statistics: this.userStatistics
        });
      })
    );
  }

  private updateStatistics(): void {
    if (this.userBorrowInfo) {
      this.currentlyBorrowedBooks = this.userBorrowInfo.currentBorrowedCount;
      this.totalFines = this.userBorrowInfo.fines;
      this.overdueBooks = this.userBorrowInfo.overdueBooks;
    }
    
    if (this.userStatistics) {
      this.totalBorrowedBooks = this.userStatistics.totalBooksRead;
    } else {
      // Calculate from history if statistics not available
      this.totalBorrowedBooks = this.borrowHistory.length;
    }
    
    this.returnedBooks = this.borrowHistory.filter(record => record.status === 'Returned').length;
  }

  // Search functionality
  performSearch(): void {
    const formValue = this.searchForm.value;
    
    // Reset pagination
    this.currentPage = 0;
    
    if (!formValue.query && !formValue.status && !formValue.category && !formValue.author && 
        !formValue.borrowDateFrom && !formValue.borrowDateTo && !formValue.dueDateFrom && !formValue.dueDateTo) {
      // No search criteria, show all
      this.applyCurrentFilters();
      return;
    }

    const searchRequest: BorrowSearchRequest = {
      memberId: this.currentUser?.memberId,
      page: this.currentPage,
      size: this.pageSize
    };

    if (formValue.query) {
      // Search in book title (backend will handle multiple field search)
      searchRequest.bookTitle = formValue.query;
    }
    if (formValue.status && formValue.status !== 'all') {
      searchRequest.status = formValue.status as BorrowStatus;
    }
    if (formValue.category) {
      searchRequest.category = formValue.category;
    }
    if (formValue.author) {
      searchRequest.author = formValue.author;
    }
    if (formValue.borrowDateFrom) {
      searchRequest.borrowDateFrom = formValue.borrowDateFrom;
    }
    if (formValue.borrowDateTo) {
      searchRequest.borrowDateTo = formValue.borrowDateTo;
    }
    if (formValue.dueDateFrom) {
      searchRequest.dueDateFrom = formValue.dueDateFrom;
    }
    if (formValue.dueDateTo) {
      searchRequest.dueDateTo = formValue.dueDateTo;
    }
    if (typeof formValue.includeReturned === 'boolean') {
      searchRequest.includeReturned = formValue.includeReturned;
    }

    this.isLoading = true;
    this.subscriptions.add(
      this.userService.searchBorrowHistory(searchRequest).subscribe({
        next: (response) => {
          this.borrowHistory = response.content;
          this.totalElements = response.totalElements;
          this.totalPages = response.totalPages;
          this.applyCurrentFilters();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Search error:', error);
          this.showError('Search failed. Please try again.');
          this.isLoading = false;
        }
      })
    );
  }

  clearSearch(): void {
    this.searchForm.reset({
      includeReturned: true
    });
    this.refreshData();
  }

  toggleAdvancedSearch(): void {
    this.showAdvancedSearch = !this.showAdvancedSearch;
  }

  // Filter functionality
  applyFilters(): void {
    this.applyCurrentFilters();
  }

  private applyCurrentFilters(): void {
    let filtered = [...this.borrowHistory];
    const { startDate, endDate, status } = this.filterForm.value;

    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(record => record.borrowDate >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(record => record.borrowDate <= end);
    }

    if (status && status !== 'all') {
      filtered = filtered.filter(record => record.status.toLowerCase() === status.toLowerCase());
    }

    this.filteredHistory = filtered;
    this.sortHistoryByDate();
  }

  clearFilters(): void {
    this.filterForm.reset({ status: 'all' });
    this.applyCurrentFilters();
  }

  private sortHistoryByDate(): void {
    this.filteredHistory.sort((a, b) => 
      b.borrowDate.getTime() - a.borrowDate.getTime()
    );
  }

  // Load more results (pagination)
  loadMore(): void {
    if (this.currentPage < this.totalPages - 1 && !this.isLoadingMore) {
      this.currentPage++;
      this.isLoadingMore = true;
      
      if (this.currentUser) {
        this.subscriptions.add(
          this.userService.getUserBorrowHistory(this.currentUser.memberId, this.currentPage, this.pageSize).subscribe({
            next: (moreHistory) => {
              this.borrowHistory = [...this.borrowHistory, ...moreHistory];
              this.applyCurrentFilters();
              this.isLoadingMore = false;
            },
            error: (error) => {
              console.error('Load more error:', error);
              this.isLoadingMore = false;
            }
          })
        );
      }
    }
  }

  hasMoreResults(): boolean {
    return this.currentPage < this.totalPages - 1;
  }

  // Book actions
  extendBookDueDate(entry: BorrowHistoryEntry, days: number = 7): void {
    if (entry.status !== 'Borrowed') {
      this.showError('Only currently borrowed books can be extended.');
      return;
    }

    this.subscriptions.add(
      this.userService.extendBookDueDate(entry.id, days).subscribe({
        next: (response) => {
          if (response.success) {
            this.showSuccess(response.message);
            this.refreshData();
          } else {
            this.showError(response.message);
          }
        },
        error: (error) => {
          this.showError(error.message || 'Failed to extend due date.');
        }
      })
    );
  }

  returnBookEarly(entry: BorrowHistoryEntry, notes?: string): void {
    if (entry.status !== 'Borrowed') {
      this.showError('Book is not currently borrowed.');
      return;
    }

    const confirmReturn = confirm(`Are you sure you want to return "${entry.title}" now?`);
    if (!confirmReturn) return;

    this.subscriptions.add(
      this.userService.returnBook(entry.id, notes).subscribe({
        next: (response) => {
          if (response.success) {
            this.showSuccess(response.message);
            this.refreshData();
          } else {
            this.showError(response.message);
          }
        },
        error: (error) => {
          this.showError(error.message || 'Failed to return book.');
        }
      })
    );
  }

  // Data refresh
  refreshData(): void {
    this.userDataService.refreshUserData();
  }

  // Utility methods
  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'returned': return 'status-returned';
      case 'borrowed': return 'status-borrowed';
      case 'overdue': return 'status-overdue';
      case 'lost': return 'status-lost';
      case 'damaged': return 'status-damaged';
      default: return '';
    }
  }

  getStatusIcon(status: BorrowStatus): string {
    switch (status) {
      case 'Returned': return '✅';
      case 'Borrowed': return '📚';
      case 'Overdue': return '⚠️';
      case 'Lost': return '🔍';
      case 'Damaged': return '⚠️';
      default: return '❓';
    }
  }

  getDaysUntilDue(dueDate: Date): number {
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  canExtendBook(entry: BorrowHistoryEntry): boolean {
    return entry.status === 'Borrowed' && 
           (entry.renewalCount || 0) < (entry.maxRenewalsAllowed || 2) &&
           this.getDaysUntilDue(entry.dueDate) > -7; // Not too overdue
  }

  canReturnEarly(entry: BorrowHistoryEntry): boolean {
    return entry.status === 'Borrowed';
  }

  // Export functionality
  exportToPDF(): void {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(44, 62, 80);
    doc.text('My Books - Borrow & Return History', 20, 20);
    
    if (this.currentUser) {
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Member: ${this.currentUser.memberName}`, 20, 30);
      doc.text(`Member ID: ${this.currentUser.memberId}`, 20, 37);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 44);
    }

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Books Borrowed: ${this.totalBorrowedBooks}`, 20, 55);
    doc.text(`Currently Borrowed: ${this.currentlyBorrowedBooks}`, 90, 55);
    doc.text(`Overdue Books: ${this.overdueBooks}`, 160, 55);
    doc.text(`Total Fines: ₹${this.totalFines}`, 20, 62);

    const tableData = this.filteredHistory.map(record => [
      record.bookId,
      record.title,
      record.author,
      record.borrowDate.toLocaleDateString(),
      record.dueDate.toLocaleDateString(),
      record.returnedDate ? record.returnedDate.toLocaleDateString() : 'Not Returned',
      record.fineAmount > 0 ? `₹${record.fineAmount}` : '₹0',
      record.status
    ]);

    autoTable(doc, {
      startY: 70,
      head: [['Book ID', 'Title', 'Author', 'Borrow Date', 'Due Date', 'Return Date', 'Fine', 'Status']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { 
        fillColor: [52, 152, 219],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      margin: { left: 20, right: 20 }
    });

    const fileName = `My_Books_History_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }

  exportToCSV(): void {
    const headers = ['Book ID', 'Title', 'Author', 'Category', 'Borrow Date', 'Due Date', 'Return Date', 'Fine Amount', 'Status', 'Notes'];
    const csvData = this.filteredHistory.map(record => [
      record.bookId,
      `"${record.title}"`,
      `"${record.author}"`,
      `"${record.category}"`,
      record.borrowDate.toLocaleDateString(),
      record.dueDate.toLocaleDateString(),
      record.returnedDate ? record.returnedDate.toLocaleDateString() : 'Not Returned',
      record.fineAmount,
      record.status,
      `"${record.notes || ''}"`
    ]);

    const csvContent = [headers, ...csvData].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `My_Books_History_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // Message handling
  private showError(message: string): void {
    this.errorMessage = message;
    this.successMessage = '';
    setTimeout(() => this.clearMessages(), 5000);
  }

  private showSuccess(message: string): void {
    this.successMessage = message;
    this.errorMessage = '';
    setTimeout(() => this.clearMessages(), 8000);
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  // Navigation
  navigateToBorrowBooks(): void {
    this.router.navigate(['/books']);
  }

  navigateToSearchBooks(): void {
    this.router.navigate(['/books']);
  }

  navigateToProfile(): void {
    this.router.navigate(['/profile']);
  }

  navigateToFines(): void {
    this.router.navigate(['/fines']);
  }

  // Tracking function for ngFor
  trackByRecordId(index: number, record: BorrowHistoryEntry): string {
    return record.id;
  }

  // Math helper methods (keep for template compatibility)
  getMathAbs(value: number): number {
    return Math.abs(value);
  }

  getMathFloor(value: number): number {
    return Math.floor(value);
  }

  getMathCeil(value: number): number {
    return Math.ceil(value);
  }

  // Format helpers
  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  }
}
