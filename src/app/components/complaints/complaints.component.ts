import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subscription, debounceTime } from 'rxjs';

import { ComplaintService } from '../../services/complaint.service';
import { AuthService } from '../../services/auth.service';
import { 
  Complaint, 
  ComplaintFormData, 
  ComplaintCategory, 
  ContactPreference,
  ComplaintStatus,
  ComplaintAction,
  ComplaintStatistics,
  ComplaintSearchRequest
} from '../../models/complaint.model';
import { AuthUser } from '../../models/auth.model';
import { NavbarComponent } from '../navbar/navbar.component';

@Component({
  selector: 'app-complaints',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NavbarComponent],
  templateUrl: './complaints.component.html',
  styleUrls: ['./complaints.component.css']
})
export class ComplaintsComponent implements OnInit, OnDestroy {
  // Forms
  complaintForm!: FormGroup;
  searchForm!: FormGroup;
  
  // Data
  complaints: Complaint[] = [];
  filteredComplaints: Complaint[] = [];
  selectedComplaint: Complaint | null = null;
  currentUser: AuthUser | null = null;
  complaintStats: ComplaintStatistics = {
    totalComplaints: 0,
    openComplaints: 0,
    inProgressComplaints: 0,
    resolvedComplaints: 0,
    closedComplaints: 0,
    averageResolutionTime: 0,
    complaintsByCategory: {},
    complaintsByPriority: {}
  };

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;

  // UI States
  showRegistrationForm = false;
  showComplaintDetails = false;
  showSearchFilters = false;
  isSubmitting = false;
  isLoading = false;
  isLoadingStats = false;
  isUpdating = false;
  editingComplaintId: string | null = null;

  // Messages
  successMessage = '';
  errorMessage = '';

  // Configuration
  complaintCategories: ComplaintCategory[] = [];
  contactPreferences: ContactPreference[] = ['Email', 'Phone'];
  statusOptions: ComplaintStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];

  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private complaintService: ComplaintService,
    private authService: AuthService,
    public router: Router
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadComplaintCategories();
    this.loadComplaints();
    this.loadComplaintStats();
    this.setupRealtimeUpdates();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private initializeForms(): void {
    // Complaint form
    this.complaintForm = this.fb.group({
      category: ['', [Validators.required]],
      title: ['', [
        Validators.required, 
        Validators.minLength(10), 
        Validators.maxLength(100)
      ]],
      description: ['', [
        Validators.required, 
        Validators.minLength(20), 
        Validators.maxLength(1000)
      ]],
      contactPreference: ['', [Validators.required]]
    });

    // Search form
    this.searchForm = this.fb.group({
      query: [''],
      category: [''],
      status: [''],
      dateFrom: [''],
      dateTo: ['']
    });
  }

  private loadCurrentUser(): void {
    this.subscriptions.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        if (!user) {
          this.router.navigate(['/login']);
        }
      })
    );
  }

  private loadComplaintCategories(): void {
    this.subscriptions.add(
      this.complaintService.getComplaintCategories().subscribe({
        next: (categories) => {
          this.complaintCategories = categories;
        },
        error: (error) => {
          console.error('Error loading categories:', error);
          // Fallback to default categories
          this.complaintCategories = [
            'Library Service',
            'Borrowing Process', 
            'Payment Issues',
            'Book Condition',
            'Staff Behavior',
            'System Technical',
            'Facility Issues',
            'Other'
          ];
        }
      })
    );
  }

  private setupRealtimeUpdates(): void {
    // Subscribe to complaints observable for real-time updates
    this.subscriptions.add(
      this.complaintService.complaints$.subscribe(complaints => {
        this.complaints = complaints;
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

  private loadComplaints(page: number = 0): void {
    this.isLoading = true;
    this.subscriptions.add(
      this.complaintService.getUserComplaints(page, this.pageSize).subscribe({
        next: (response) => {
          if (page === 0) {
            this.complaints = response.complaints;
          } else {
            this.complaints = [...this.complaints, ...response.complaints];
          }
          
          this.totalElements = response.totalCount;
          this.totalPages = response.totalPages || 0;
          this.currentPage = response.currentPage || 0;
          
          this.applyCurrentFilters();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Load complaints error:', error);
          this.showError('Unable to fetch complaints. Please try again later.');
          this.isLoading = false;
        }
      })
    );
  }

  private loadComplaintStats(): void {
    this.isLoadingStats = true;
    this.subscriptions.add(
      this.complaintService.getComplaintStatistics().subscribe({
        next: (stats) => {
          this.complaintStats = stats;
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
    
    if (!formValue.query && !formValue.category && !formValue.status && !formValue.dateFrom && !formValue.dateTo) {
      // No filters applied, show all complaints
      this.filteredComplaints = [...this.complaints];
      return;
    }

    const searchRequest: ComplaintSearchRequest = {
      query: formValue.query || undefined,
      category: formValue.category || undefined,
      status: formValue.status || undefined,
      dateFrom: formValue.dateFrom || undefined,
      dateTo: formValue.dateTo || undefined,
      page: 0,
      size: this.pageSize
    };

    this.subscriptions.add(
      this.complaintService.searchComplaints(searchRequest).subscribe({
        next: (response) => {
          this.filteredComplaints = response.content;
          this.totalElements = response.totalElements;
          this.totalPages = response.totalPages;
          this.currentPage = 0;
        },
        error: (error) => {
          console.error('Search error:', error);
          this.showError('Search failed. Please try again.');
        }
      })
    );
  }

  private applyCurrentFilters(): void {
    // Apply current search filters to the complaints
    const formValue = this.searchForm.value;
    
    if (!formValue.query && !formValue.category && !formValue.status && !formValue.dateFrom && !formValue.dateTo) {
      this.filteredComplaints = [...this.complaints];
    } else {
      this.performSearch();
    }
  }

  clearSearch(): void {
    this.searchForm.reset();
    this.filteredComplaints = [...this.complaints];
  }

  toggleSearchFilters(): void {
    this.showSearchFilters = !this.showSearchFilters;
  }

  // Form Actions
  onShowRegistrationForm(): void {
    this.showRegistrationForm = true;
    this.editingComplaintId = null;
    this.resetForm();
  }

  onEditComplaint(complaint: Complaint): void {
    if (complaint.status !== 'Open') {
      this.showError('Only open complaints can be edited.');
      return;
    }

    this.editingComplaintId = complaint.id;
    this.showRegistrationForm = true;
    
    // Populate form with existing data
    this.complaintForm.patchValue({
      category: complaint.category,
      title: complaint.title,
      description: complaint.description,
      contactPreference: complaint.contactPreference
    });
  }

  onSubmitComplaint(): void {
    if (this.complaintForm.invalid) {
      this.markFormGroupTouched();
      this.showError('Please fix all validation errors before submitting.');
      return;
    }

    this.isSubmitting = true;
    this.clearMessages();

    const formData: ComplaintFormData = this.complaintForm.value;

    if (this.editingComplaintId) {
      // Update existing complaint
      this.subscriptions.add(
        this.complaintService.updateComplaint(this.editingComplaintId, formData).subscribe({
          next: (response) => {
            if (response.success) {
              this.showSuccess(response.message);
              this.resetForm();
              this.showRegistrationForm = false;
              this.editingComplaintId = null;
              this.loadComplaintStats();
            } else {
              this.showError(response.message);
            }
            this.isSubmitting = false;
          },
          error: (error) => {
            console.error('Update complaint error:', error);
            this.showError(error.message || 'Failed to update complaint. Please try again.');
            this.isSubmitting = false;
          }
        })
      );
    } else {
      // Submit new complaint
      this.subscriptions.add(
        this.complaintService.submitComplaint(formData).subscribe({
          next: (response) => {
            if (response.success) {
              this.showSuccess(response.message);
              this.resetForm();
              this.showRegistrationForm = false;
              this.loadComplaintStats();
            } else {
              this.showError(response.message);
            }
            this.isSubmitting = false;
          },
          error: (error) => {
            console.error('Submit complaint error:', error);
            this.showError(error.message || 'Failed to submit complaint. Please try again.');
            this.isSubmitting = false;
          }
        })
      );
    }
  }

  onResetForm(): void {
    this.resetForm();
    this.showRegistrationForm = false;
    this.editingComplaintId = null;
  }

  onCancelForm(): void {
    this.showRegistrationForm = false;
    this.editingComplaintId = null;
    this.resetForm();
  }

  // Complaint Actions
  onViewComplaint(complaint: Complaint): void {
    // Fetch latest complaint details from backend
    this.subscriptions.add(
      this.complaintService.getComplaintById(complaint.id).subscribe({
        next: (detailedComplaint) => {
          this.selectedComplaint = detailedComplaint;
          this.showComplaintDetails = true;
        },
        error: (error) => {
          console.error('Error loading complaint details:', error);
          // Fallback to current data
          this.selectedComplaint = complaint;
          this.showComplaintDetails = true;
        }
      })
    );
  }

  onCloseComplaintDetails(): void {
    this.showComplaintDetails = false;
    this.selectedComplaint = null;
  }

  onConfirmResolution(complaintId: string): void {
    const confirmationMessage = 'Are you sure you want to confirm that this complaint has been resolved to your satisfaction?';
    if (!confirm(confirmationMessage)) return;

    const action: ComplaintAction = {
      action: 'confirm_resolution',
      complaintId: complaintId
    };

    this.isUpdating = true;
    this.subscriptions.add(
      this.complaintService.handleComplaintAction(action).subscribe({
        next: (response) => {
          if (response.success) {
            this.showSuccess(response.message);
            this.loadComplaintStats();
            this.onCloseComplaintDetails();
          } else {
            this.showError(response.message);
          }
          this.isUpdating = false;
        },
        error: (error) => {
          console.error('Confirm resolution error:', error);
          this.showError(error.message || 'Unable to process the request. Please try again later.');
          this.isUpdating = false;
        }
      })
    );
  }

  onReopenComplaint(complaintId: string): void {
    const reopenReason = prompt('Please provide a reason for reopening this complaint:');
    if (!reopenReason || reopenReason.trim().length < 10) {
      this.showError('Please provide a detailed reason (at least 10 characters) for reopening.');
      return;
    }

    const action: ComplaintAction = {
      action: 'reopen',
      complaintId: complaintId,
      notes: reopenReason.trim()
    };

    this.isUpdating = true;
    this.subscriptions.add(
      this.complaintService.handleComplaintAction(action).subscribe({
        next: (response) => {
          if (response.success) {
            this.showSuccess(response.message);
            this.loadComplaintStats();
            this.onCloseComplaintDetails();
          } else {
            this.showError(response.message);
          }
          this.isUpdating = false;
        },
        error: (error) => {
          console.error('Reopen complaint error:', error);
          this.showError(error.message || 'Unable to process the request. Please try again later.');
          this.isUpdating = false;
        }
      })
    );
  }

  onDeleteComplaint(complaintId: string): void {
    const confirmMessage = 'Are you sure you want to delete this complaint? This action cannot be undone.';
    if (!confirm(confirmMessage)) return;

    this.isUpdating = true;
    this.subscriptions.add(
      this.complaintService.deleteComplaint(complaintId).subscribe({
        next: (response) => {
          if (response.success) {
            this.showSuccess(response.message);
            this.loadComplaintStats();
            this.onCloseComplaintDetails();
          } else {
            this.showError(response.message);
          }
          this.isUpdating = false;
        },
        error: (error) => {
          console.error('Delete complaint error:', error);
          this.showError(error.message || 'Unable to delete complaint. Please try again later.');
          this.isUpdating = false;
        }
      })
    );
  }

  // Pagination
  loadMore(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.loadComplaints(this.currentPage + 1);
    }
  }

  hasMoreComplaints(): boolean {
    return this.currentPage < this.totalPages - 1;
  }

  // Helper Methods
  private resetForm(): void {
    this.complaintForm.reset();
    this.clearMessages();
  }

  private markFormGroupTouched(): void {
    Object.keys(this.complaintForm.controls).forEach(key => {
      const control = this.complaintForm.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.complaintForm.get(fieldName);
    if (field && field.errors && field.touched) {
      const errors = field.errors;
      
      if (errors['required']) {
        return `${this.getFieldDisplayName(fieldName)} is required.`;
      }
      
      if (errors['minlength']) {
        const requiredLength = errors['minlength'].requiredLength;
        if (fieldName === 'title') {
          return 'Please provide a more descriptive title (at least 10 characters).';
        }
        if (fieldName === 'description') {
          return 'Please provide more detailed description to help us resolve your issue (at least 20 characters).';
        }
        return `${this.getFieldDisplayName(fieldName)} must be at least ${requiredLength} characters.`;
      }
      
      if (errors['maxlength']) {
        const maxLength = errors['maxlength'].requiredLength;
        return `${this.getFieldDisplayName(fieldName)} cannot exceed ${maxLength} characters.`;
      }
    }
    
    return '';
  }

  private getFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      category: 'Complaint Category',
      title: 'Complaint Title',
      description: 'Complaint Description',
      contactPreference: 'Contact Preference'
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
  refreshComplaints(): void {
    this.complaintService.refreshComplaints();
    this.loadComplaintStats();
  }

  // UI Helper Methods
  getStatusClass(status: ComplaintStatus): string {
    switch (status) {
      case 'Open': return 'status-open';
      case 'In Progress': return 'status-in-progress';
      case 'Resolved': return 'status-resolved';
      case 'Closed': return 'status-closed';
      default: return '';
    }
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'Critical': return 'priority-critical';
      case 'High': return 'priority-high';
      case 'Medium': return 'priority-medium';
      case 'Low': return 'priority-low';
      default: return '';
    }
  }

  getStatusIcon(status: ComplaintStatus): string {
    switch (status) {
      case 'Open': return '🔓';
      case 'In Progress': return '⏳';
      case 'Resolved': return '✅';
      case 'Closed': return '🔒';
      default: return '❓';
    }
  }

  getPriorityIcon(priority: string): string {
    switch (priority) {
      case 'Critical': return '🔴';
      case 'High': return '🟠';
      case 'Medium': return '🟡';
      case 'Low': return '🟢';
      default: return '⚪';
    }
  }

  isFormValid(): boolean {
    return this.complaintForm.valid;
  }

  canEditComplaint(complaint: Complaint): boolean {
    return complaint.status === 'Open';
  }

  canDeleteComplaint(complaint: Complaint): boolean {
    return complaint.status === 'Open';
  }

  canConfirmResolution(complaint: Complaint): boolean {
    return complaint.status === 'Resolved';
  }

  canReopenComplaint(complaint: Complaint): boolean {
    return complaint.status === 'Resolved';
  }

  trackByComplaintId(index: number, complaint: Complaint): string {
    return complaint.id;
  }

  // Format helpers
  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  }

  getFormTitle(): string {
    return this.editingComplaintId ? 'Edit Complaint' : 'Submit New Complaint';
  }

  getSubmitButtonText(): string {
    if (this.isSubmitting) {
      return this.editingComplaintId ? 'Updating...' : 'Submitting...';
    }
    return this.editingComplaintId ? 'Update Complaint' : 'Submit Complaint';
  }
}
