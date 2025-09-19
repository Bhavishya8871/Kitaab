import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subscription, debounceTime } from 'rxjs';

import { FineService } from '../../services/fine.service';
import { AuthService } from '../../services/auth.service';
import { 
  FineRecord, 
  PaymentRecord, 
  PaymentMethodInfo,
  PaymentRequest,
  DummyPaymentForm,
  PaymentMethod,
  FineStatistics
} from '../../models/fine.model';
import { AuthUser } from '../../models/auth.model';
import { NavbarComponent } from '../navbar/navbar.component';

@Component({
  selector: 'app-fines',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NavbarComponent],
  templateUrl: './fines.component.html',
  styleUrls: ['./fines.component.css']
})
export class FinesComponent implements OnInit, OnDestroy {
  // Data
  fines: FineRecord[] = [];
  filteredFines: FineRecord[] = [];
  selectedFines: Set<string> = new Set();
  paymentHistory: PaymentRecord[] = [];
  paymentMethods: PaymentMethodInfo[] = [];
  currentUser: AuthUser | null = null;

  // Statistics
  fineStats: FineStatistics = {
    totalOutstandingFines: 0,
    totalOverdueBooks: 0,
    totalPaidFines: 0,
    averageDaysOverdue: 0,
    finesByMonth: [],
    paymentHistory: []
  };

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;

  // Forms
  paymentForm!: FormGroup;
  searchForm!: FormGroup;

  // UI States
  showPaymentModal = false;
  showPaymentForm = false;
  showReceiptModal = false;
  showSearchFilters = false;
  isLoading = false;
  isLoadingStats = false;
  isProcessingPayment = false;
  
  // Selected data
  selectedPaymentMethod: PaymentMethodInfo | null = null;
  selectedReceipt: PaymentRecord | null = null;

  // Messages
  errorMessage = '';
  successMessage = '';

  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private fineService: FineService,
    private authService: AuthService,
    public router: Router
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadPaymentMethods();
    this.setupRealtimeUpdates();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private initializeForms(): void {
    // Payment form
    this.paymentForm = this.fb.group({
      paymentMethod: ['', Validators.required],
      // Card fields
      cardNumber: [''],
      cardName: [''],
      expiryMonth: [''],
      expiryYear: [''],
      cvv: [''],
      // UPI field
      upiId: [''],
      // Net banking
      bankName: [''],
      // Wallet
      walletProvider: [''],
      walletNumber: ['']
    });

    // Search form
    this.searchForm = this.fb.group({
      query: [''],
      status: [''],
      minAmount: [''],
      maxAmount: [''],
      dateFrom: [''],
      dateTo: ['']
    });
  }

  private loadCurrentUser(): void {
    this.subscriptions.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        if (user) {
          this.loadUserData(user.memberId);
        } else {
          this.router.navigate(['/login']);
        }
      })
    );
  }

  private loadPaymentMethods(): void {
    this.paymentMethods = this.fineService.getPaymentMethods();
  }

  private setupRealtimeUpdates(): void {
    // Subscribe to fines observable for real-time updates
    this.subscriptions.add(
      this.fineService.fines$.subscribe(fines => {
        this.fines = fines;
        this.applyCurrentFilters();
      })
    );

    // Subscribe to payments observable
    this.subscriptions.add(
      this.fineService.payments$.subscribe(payments => {
        this.paymentHistory = payments;
      })
    );
  }

  private setupSearch(): void {
    // Real-time search with debouncing
    this.subscriptions.add(
      this.searchForm.valueChanges.pipe(
        debounceTime(300)
      ).subscribe(() => {
        this.performSearch();
      })
    );
  }

  private loadUserData(memberId: string): void {
    this.isLoading = true;
    
    // Load fines
    this.subscriptions.add(
      this.fineService.getUserFines(memberId).subscribe({
        next: (fines) => {
          this.fines = fines;
          this.applyCurrentFilters();
          this.isLoading = false;
          console.log(`📋 Loaded ${fines.length} fine records for user ${memberId}:`, fines);
        },
        error: (error) => {
          console.error('❌ Failed to load fine information:', error);
          this.showError('Failed to load fine information.');
          this.isLoading = false;
        }
      })
    );

    // Load payment history
    this.subscriptions.add(
      this.fineService.getUserPayments(memberId).subscribe({
        next: (payments) => {
          this.paymentHistory = payments;
        },
        error: (error) => {
          console.error('Failed to load payment history:', error);
        }
      })
    );

    // Load statistics
    this.loadFineStatistics(memberId);
  }

  private loadFineStatistics(memberId: string): void {
    this.isLoadingStats = true;
    this.subscriptions.add(
      this.fineService.getFineStatistics(memberId).subscribe({
        next: (stats) => {
          this.fineStats = stats;
          this.isLoadingStats = false;
        },
        error: (error) => {
          console.error('Load fine stats error:', error);
          this.isLoadingStats = false;
        }
      })
    );
  }

  // Search and Filter Methods
  performSearch(): void {
    const formValue = this.searchForm.value;
    
    if (!formValue.query && !formValue.status && !formValue.minAmount && !formValue.maxAmount && !formValue.dateFrom && !formValue.dateTo) {
      // No filters applied, show all fines
      this.filteredFines = [...this.fines];
      return;
    }

    // Apply local filtering
    let filtered = [...this.fines];

    if (formValue.query) {
      const query = formValue.query.toLowerCase();
      filtered = filtered.filter(fine =>
        fine.bookTitle.toLowerCase().includes(query) ||
        fine.author.toLowerCase().includes(query)
      );
    }

    if (formValue.status) {
      filtered = filtered.filter(fine => fine.status === formValue.status);
    }

    if (formValue.minAmount) {
      filtered = filtered.filter(fine => fine.totalFine >= parseFloat(formValue.minAmount));
    }

    if (formValue.maxAmount) {
      filtered = filtered.filter(fine => fine.totalFine <= parseFloat(formValue.maxAmount));
    }

    if (formValue.dateFrom) {
      const fromDate = new Date(formValue.dateFrom);
      filtered = filtered.filter(fine => fine.dueDate >= fromDate);
    }

    if (formValue.dateTo) {
      const toDate = new Date(formValue.dateTo);
      filtered = filtered.filter(fine => fine.dueDate <= toDate);
    }

    this.filteredFines = filtered;
  }

  private applyCurrentFilters(): void {
    this.filteredFines = [...this.fines];
    this.performSearch();
  }

  clearSearch(): void {
    this.searchForm.reset();
    this.applyCurrentFilters();
  }

  toggleSearchFilters(): void {
    this.showSearchFilters = !this.showSearchFilters;
  }

  // Fine selection
  onFineSelectionChange(fineId: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    const isSelected = target.checked;
    
    if (isSelected) {
      this.selectedFines.add(fineId);
    } else {
      this.selectedFines.delete(fineId);
    }
  }

  onSelectAllFines(): void {
    this.filteredFines.forEach(fine => this.selectedFines.add(fine.id));
  }

  onDeselectAllFines(): void {
    this.selectedFines.clear();
  }

  getSelectedFines(): FineRecord[] {
    return this.filteredFines.filter(fine => this.selectedFines.has(fine.id));
  }

  getSelectedTotal(): number {
    return this.getSelectedFines().reduce((total, fine) => total + fine.totalFine, 0);
  }

  // Payment flow
  onPaySelected(): void {
    if (this.selectedFines.size === 0) {
      this.showError('Please select at least one fine to pay.');
      return;
    }
    this.showPaymentModal = true;
  }

  onPaymentMethodSelect(method: PaymentMethodInfo): void {
    this.selectedPaymentMethod = method;
    this.paymentForm.patchValue({ paymentMethod: method.id });
    this.showPaymentForm = true;
  }

  onSubmitPayment(): void {
    if (!this.currentUser || !this.selectedPaymentMethod) return;

    // Validate form based on payment method
    const validation = this.fineService.validatePaymentData(this.selectedPaymentMethod.id, this.paymentForm.value);
    if (!validation.isValid) {
      this.showError(validation.errors.join(', '));
      return;
    }

    this.isProcessingPayment = true;
    this.clearMessages();

    const paymentRequest: PaymentRequest = {
      memberId: this.currentUser.memberId,
      fineIds: Array.from(this.selectedFines),
      totalAmount: this.getSelectedTotal(),
      paymentMethod: this.selectedPaymentMethod.id,
      customerInfo: {
        name: this.currentUser.memberName,
        email: this.currentUser.email
      }
    };

    const paymentFormData: DummyPaymentForm = {
      paymentMethod: this.selectedPaymentMethod.id,
      ...this.paymentForm.value
    };

    this.subscriptions.add(
      this.fineService.processPayment(paymentRequest, paymentFormData).subscribe({
        next: (response) => {
          this.isProcessingPayment = false;
          
          if (response.success) {
            this.showSuccess(response.message || 'Payment processed successfully!');
            this.closePaymentModal();
            this.selectedFines.clear();
            
            // Reload statistics
            if (this.currentUser) {
              this.loadFineStatistics(this.currentUser.memberId);
            }
            
            // Show receipt option
            if (response.paymentId) {
              setTimeout(() => {
                this.showSuccess('Payment successful! Receipt has been generated.');
              }, 1000);
            }
          } else {
            this.showError(response.message || 'Payment processing failed.');
          }
        },
        error: (error) => {
          this.isProcessingPayment = false;
          this.showError(error.message || 'Payment processing failed. Please try again.');
        }
      })
    );
  }

  // Modal controls
  closePaymentModal(): void {
    this.showPaymentModal = false;
    this.showPaymentForm = false;
    this.selectedPaymentMethod = null;
    this.paymentForm.reset();
  }

  onViewReceipt(payment: PaymentRecord): void {
    // Fetch latest payment details from backend
    this.subscriptions.add(
      this.fineService.getPaymentById(payment.paymentId).subscribe({
        next: (detailedPayment) => {
          this.selectedReceipt = detailedPayment;
          this.showReceiptModal = true;
        },
        error: (error) => {
          console.error('Error loading payment details:', error);
          // Fallback to current data
          this.selectedReceipt = payment;
          this.showReceiptModal = true;
        }
      })
    );
  }

  onDownloadReceipt(payment: PaymentRecord): void {
    this.fineService.downloadReceipt(payment);
  }

  closeReceiptModal(): void {
    this.showReceiptModal = false;
    this.selectedReceipt = null;
  }

  // Refresh data
  refreshFines(): void {
    this.fineService.refreshData();
    if (this.currentUser) {
      this.loadFineStatistics(this.currentUser.memberId);
    }
  }

  // Helper methods
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

  getDaysOverdueText(days: number): string {
    return days === 1 ? '1 day' : `${days} days`;
  }

  getPaymentMethodIcon(method: string): string {
    switch (method) {
      case 'card': return '💳';
      case 'upi': return '📱';
      case 'netbanking': return '🏦';
      case 'wallet': return '👛';
      case 'cash': return '💰';
      default: return '💰';
    }
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'completed': return 'status-completed';
      case 'pending': return 'status-pending';
      case 'failed': return 'status-failed';
      case 'paid': return 'status-paid';
      case 'waived': return 'status-waived';
      case 'overdue': return 'status-overdue';
      default: return '';
    }
  }

  getStatusIcon(status: string): string {
    switch (status.toLowerCase()) {
      case 'pending': return '⏳';
      case 'paid': return '✅';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'waived': return '🎁';
      case 'overdue': return '⚠️';
      default: return '❓';
    }
  }

  // Navigation
  navigateToBooks(): void {
    this.router.navigate(['/books']);
  }

  navigateToMyBooks(): void {
    this.router.navigate(['/my-books']);
  }

  trackByFineId(index: number, fine: FineRecord): string {
    return fine.id;
  }

  trackByPaymentId(index: number, payment: PaymentRecord): string {
    return payment.id;
  }

  // Format helpers
  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(date));
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  }

  // Getter methods for template
  get totalPendingFines(): number {
    return this.fineStats.totalOutstandingFines;
  }

  get totalBooksOverdue(): number {
    return this.fineStats.totalOverdueBooks;
  }
}
