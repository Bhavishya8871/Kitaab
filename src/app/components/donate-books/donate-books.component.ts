import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subscription, debounceTime } from 'rxjs';

import { DonationService } from '../../services/donation.service';
import { AuthService } from '../../services/auth.service';
import { 
  Donation, 
  DonationFormData, 
  DonationStatus, 
  DonationCondition,
  DonationStatistics,
  DonationConditionValue
} from '../../models/donation.model';
import { AuthUser } from '../../models/auth.model';
import { NavbarComponent } from "../navbar/navbar.component";

@Component({
  selector: 'app-donate-books',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule, NavbarComponent],
  templateUrl: './donate-books.component.html',
  styleUrls: ['./donate-books.component.css']
})
export class DonateBooksComponent implements OnInit, OnDestroy {
  donationForm!: FormGroup;
  searchForm!: FormGroup;
  currentUser: AuthUser | null = null;
  donations: Donation[] = [];
  filteredDonations: Donation[] = [];
  
  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;
  
  // States
  isSubmitting = false;
  isLoading = false;
  isLoadingStats = false;
  showConfirmation = false;
  showSearchFilters = false;
  
  // Messages
  successMessage = '';
  errorMessage = '';
  
  // Filter
  statusFilter = 'all';
  
  // Statistics
  donationStats: DonationStatistics = {
    totalDonations: 0,
    pendingDonations: 0,
    acceptedDonations: 0,
    rejectedDonations: 0,
    donationsByCondition: {},
    donationsByMonth: []
  };

  // File handling
  selectedFile: File | null = null;
  photoPreview: string | null = null;

  private subscriptions = new Subscription();

  // Condition options from service
  conditionOptions: DonationCondition[] = [];

  constructor(
    private fb: FormBuilder,
    private donationService: DonationService,
    private authService: AuthService,
    private router: Router
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadConditionOptions();
    this.setupRealtimeUpdates();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private initializeForms(): void {
    // Donation form
    this.donationForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      author: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      condition: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1), Validators.max(50)]],
      notes: ['', Validators.maxLength(500)]
    });

    // Search form
    this.searchForm = this.fb.group({
      query: [''],
      status: [''],
      condition: [''],
      dateFrom: [''],
      dateTo: ['']
    });
  }

  private loadCurrentUser(): void {
    this.subscriptions.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        if (user) {
          this.loadDonations();
          this.loadDonationStats();
        } else {
          this.router.navigate(['/login']);
        }
      })
    );
  }

  private loadConditionOptions(): void {
    this.conditionOptions = this.donationService.getDonationConditions();
  }

  private setupRealtimeUpdates(): void {
    // Subscribe to donations observable for real-time updates
    this.subscriptions.add(
      this.donationService.donations$.subscribe(donations => {
        this.donations = donations;
        this.applyCurrentFilters();
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

  private loadDonations(page: number = 0): void {
    this.isLoading = true;
    this.subscriptions.add(
      this.donationService.getUserDonations(page, this.pageSize).subscribe({
        next: (response) => {
          if (page === 0) {
            this.donations = response.donations;
          } else {
            this.donations = [...this.donations, ...response.donations];
          }
          
          this.totalElements = response.totalCount;
          this.totalPages = response.totalPages || 0;
          this.currentPage = response.currentPage || 0;
          
          this.applyCurrentFilters();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Load donations error:', error);
          this.showError('Unable to fetch donations. Please try again later.');
          this.isLoading = false;
        }
      })
    );
  }

  private loadDonationStats(): void {
    this.isLoadingStats = true;
    this.subscriptions.add(
      this.donationService.getDonationStatistics().subscribe({
        next: (stats) => {
          this.donationStats = stats;
          this.isLoadingStats = false;
        },
        error: (error) => {
          console.error('Load stats error:', error);
          this.isLoadingStats = false;
        }
      })
    );
  }

  // Search and Filter Methods
  performSearch(): void {
    const formValue = this.searchForm.value;
    
    if (!formValue.query && !formValue.status && !formValue.condition && !formValue.dateFrom && !formValue.dateTo) {
      // No filters applied, show all donations
      this.filteredDonations = [...this.donations];
      return;
    }

    // Apply local filtering for now, can be enhanced with backend search
    let filtered = [...this.donations];

    if (formValue.query) {
      const query = formValue.query.toLowerCase();
      filtered = filtered.filter(donation =>
        donation.title.toLowerCase().includes(query) ||
        donation.author.toLowerCase().includes(query)
      );
    }

    if (formValue.status) {
      filtered = filtered.filter(donation => donation.status === formValue.status);
    }

    if (formValue.condition) {
      filtered = filtered.filter(donation => donation.condition === formValue.condition);
    }

    if (formValue.dateFrom) {
      const fromDate = new Date(formValue.dateFrom);
      filtered = filtered.filter(donation => donation.submissionDate >= fromDate);
    }

    if (formValue.dateTo) {
      const toDate = new Date(formValue.dateTo);
      filtered = filtered.filter(donation => donation.submissionDate <= toDate);
    }

    this.filteredDonations = filtered;
  }

  private applyCurrentFilters(): void {
    if (this.statusFilter === 'all') {
      this.filteredDonations = [...this.donations];
    } else {
      this.filteredDonations = this.donations.filter(
        donation => donation.status.toLowerCase() === this.statusFilter.toLowerCase()
      );
    }
    
    // Apply search filters if any
    this.performSearch();
    
    this.sortDonationsByDate();
  }

  private sortDonationsByDate(): void {
    this.filteredDonations.sort((a, b) => 
      b.submissionDate.getTime() - a.submissionDate.getTime()
    );
  }

  clearSearch(): void {
    this.searchForm.reset();
    this.applyCurrentFilters();
  }

  toggleSearchFilters(): void {
    this.showSearchFilters = !this.showSearchFilters;
  }

  // File handling
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        this.showError('Please select a valid image file (JPEG, PNG, or GIF)');
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        this.showError('Image file size must be less than 5MB');
        return;
      }

      this.selectedFile = file;

      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        this.photoPreview = reader.result as string;
      };
      reader.onerror = () => {
        this.showError('Error reading file. Please try again.');
      };
      reader.readAsDataURL(file);
    }
  }

  removePhoto(): void {
    this.selectedFile = null;
    this.photoPreview = null;
    
    // Reset file input
    const fileInput = document.getElementById('photoInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  // Form submission
  onSubmitDonation(): void {
    if (this.donationForm.invalid) {
      this.markFormGroupTouched();
      this.showError('Please fill in all required fields correctly.');
      return;
    }

    if (!this.currentUser) {
      this.showError('User session not found. Please log in again.');
      return;
    }

    this.showConfirmation = true;
  }

  confirmSubmission(): void {
    this.isSubmitting = true;
    this.clearMessages();

    try {
      const formValue = this.donationForm.value;
      
      const donationData: DonationFormData = {
        title: formValue.title.trim(),
        author: formValue.author.trim(),
        condition: formValue.condition as DonationConditionValue,
        quantity: formValue.quantity,
        notes: formValue.notes?.trim(),
        photoFile: this.selectedFile || undefined
      };

      this.subscriptions.add(
        this.donationService.submitDonation(donationData).subscribe({
          next: (response) => {
            if (response.success) {
              // Reset form
              this.donationForm.reset();
              this.donationForm.patchValue({ quantity: 1 });
              this.removePhoto();
              this.showConfirmation = false;
              
              this.showSuccess(
                `✅ Donation submitted successfully! Your donation "${donationData.title}" is now pending review. You'll be notified when the status changes.`
              );
              
              // Refresh stats
              this.loadDonationStats();
            } else {
              this.showError(response.message);
            }
            this.isSubmitting = false;
          },
          error: (error) => {
            console.error('Submit donation error:', error);
            this.showError(error.message || 'Failed to submit donation. Please try again.');
            this.isSubmitting = false;
          }
        })
      );
    } catch (error) {
      this.showError('Failed to submit donation. Please try again.');
      console.error('Donation submission error:', error);
      this.isSubmitting = false;
    }
  }

  cancelSubmission(): void {
    this.showConfirmation = false;
  }

  // Filter methods
  onStatusFilterChange(): void {
    this.applyCurrentFilters();
  }

  // Pagination
  loadMore(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.loadDonations(this.currentPage + 1);
    }
  }

  hasMoreDonations(): boolean {
    return this.currentPage < this.totalPages - 1;
  }

  // Helper methods
  private markFormGroupTouched(): void {
    Object.keys(this.donationForm.controls).forEach(key => {
      const control = this.donationForm.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.donationForm.get(fieldName);
    if (field && field.errors && field.touched) {
      const errors = field.errors;
      
      if (errors['required']) return `${this.getFieldDisplayName(fieldName)} is required.`;
      if (errors['minlength']) return `${this.getFieldDisplayName(fieldName)} must be at least ${errors['minlength'].requiredLength} characters.`;
      if (errors['maxlength']) return `${this.getFieldDisplayName(fieldName)} cannot exceed ${errors['maxlength'].requiredLength} characters.`;
      if (errors['min']) return `${this.getFieldDisplayName(fieldName)} must be at least ${errors['min'].min}.`;
      if (errors['max']) return `${this.getFieldDisplayName(fieldName)} cannot exceed ${errors['max'].max}.`;
    }
    return '';
  }

  private getFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      title: 'Book Title',
      author: 'Author',
      condition: 'Condition',
      quantity: 'Quantity',
      notes: 'Additional Notes'
    };
    return displayNames[fieldName] || fieldName;
  }

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

  // Refresh data
  refreshDonations(): void {
    this.donationService.refreshDonations();
    this.loadDonationStats();
  }

  // UI Helper Methods
  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'pending': return 'status-pending';
      case 'accepted': return 'status-accepted';
      case 'rejected': return 'status-rejected';
      case 'under review': return 'status-under-review';
      default: return '';
    }
  }

  getStatusIcon(status: DonationStatus): string {
    switch (status) {
      case 'Pending': return '⏳';
      case 'Accepted': return '✅';
      case 'Rejected': return '❌';
      case 'Under Review': return '🔍';
      default: return '❓';
    }
  }

  hasPhoto(): boolean {
    return !!this.photoPreview;
  }

  getPhotoPreview(): string | null {
    return this.photoPreview;
  }

  trackByDonationId(index: number, donation: Donation): string {
    return donation.id;
  }

  // Navigation methods
  navigateToProfile(): void {
    this.router.navigate(['/profile']);
  }

  navigateToMyBooks(): void {
    this.router.navigate(['/my-books']);
  }

  navigateToBorrowBooks(): void {
    this.router.navigate(['/books']);
  }

  // Format helpers
  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(date));
  }

  // Getter methods for template
  get totalDonations(): number {
    return this.donationStats.totalDonations;
  }

  get pendingDonations(): number {
    return this.donationStats.pendingDonations;
  }

  get acceptedDonations(): number {
    return this.donationStats.acceptedDonations;
  }

  get rejectedDonations(): number {
    return this.donationStats.rejectedDonations;
  }
}
