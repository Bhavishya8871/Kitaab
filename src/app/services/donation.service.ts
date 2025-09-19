import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError , of} from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { 
  Donation, 
  DonationFormData, 
  DonationResponse, 
  DonationListResponse,
  DonationStatus,
  DonationCondition,
  DonationStatistics,
  DonationSearchRequest,
  PaginatedDonationResponse
} from '../models/donation.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class DonationService {
  private readonly API_URL = 'http://localhost:8080/api/donations';
  
  // BehaviorSubject for real-time updates
  private donationsSubject = new BehaviorSubject<Donation[]>([]);
  public donations$ = this.donationsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Load user donations on service initialization
    this.loadUserDonations();
  }

  // Load user's donations and update BehaviorSubject
  private loadUserDonations(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.getUserDonations().subscribe({
        next: (response) => {
          this.donationsSubject.next(response.donations);
        },
        error: (error) => {
          console.error('Error loading user donations:', error);
          this.donationsSubject.next([]);
        }
      });
    }
  }

  // Submit new donation
  submitDonation(formData: DonationFormData): Observable<DonationResponse> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return throwError(() => new Error('User not authenticated. Please log in and try again.'));
    }

    const donationFormData = new FormData();
    donationFormData.append('title', formData.title);
    donationFormData.append('author', formData.author);
    donationFormData.append('condition', formData.condition);
    donationFormData.append('quantity', formData.quantity.toString());
    donationFormData.append('memberId', currentUser.memberId);
    
    if (formData.notes) {
      donationFormData.append('notes', formData.notes);
    }
    
    if (formData.photoFile) {
      donationFormData.append('photo', formData.photoFile);
    }

    return this.http.post<DonationResponse>(`${this.API_URL}`, donationFormData)
      .pipe(
        tap(response => {
          if (response.success) {
            // Refresh donations list to include new donation
            this.loadUserDonations();
            console.log('✅ Donation submitted:', response.donationId);
          }
        }),
        catchError(error => {
          console.error('Submit donation error:', error);
          let errorMessage = 'Failed to submit donation. Please try again.';
          
          if (error.status === 400) {
            errorMessage = error.error?.message || 'Invalid donation data.';
          } else if (error.status === 401) {
            errorMessage = 'Authentication required. Please log in again.';
          } else if (error.status === 413) {
            errorMessage = 'Photo file is too large. Please choose a smaller image.';
          } else if (error.status === 422) {
            errorMessage = 'Validation failed. Please check your input.';
          } else if (error.status === 0) {
            errorMessage = 'Unable to connect to server. Please check your connection.';
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // Get donations for current user with pagination
  getUserDonations(page: number = 0, size: number = 10, status?: DonationStatus): Observable<DonationListResponse> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return throwError(() => new Error('User not authenticated'));
    }

    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('memberId', currentUser.memberId);
    
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<PaginatedDonationResponse>(`${this.API_URL}/user`, { params })
      .pipe(
        map(response => ({
          donations: response.content.map(donation => ({
            ...donation,
            submissionDate: new Date(donation.submissionDate),
            statusUpdatedDate: donation.statusUpdatedDate ? new Date(donation.statusUpdatedDate) : undefined
          })),
          totalCount: response.totalElements,
          totalPages: response.totalPages,
          currentPage: response.number
        })),
        catchError(error => {
          console.error('Get user donations error:', error);
          return throwError(() => error);
        })
      );
  }

  // Get donation by ID
  getDonationById(donationId: string): Observable<Donation> {
    return this.http.get<Donation>(`${this.API_URL}/${donationId}`)
      .pipe(
        map(donation => ({
          ...donation,
          submissionDate: new Date(donation.submissionDate),
          statusUpdatedDate: donation.statusUpdatedDate ? new Date(donation.statusUpdatedDate) : undefined
        })),
        catchError(error => {
          console.error('Get donation by ID error:', error);
          return throwError(() => error);
        })
      );
  }

  // Update donation (for editing pending donations)
  updateDonation(donationId: string, formData: DonationFormData): Observable<DonationResponse> {
    const donationFormData = new FormData();
    donationFormData.append('title', formData.title);
    donationFormData.append('author', formData.author);
    donationFormData.append('condition', formData.condition);
    donationFormData.append('quantity', formData.quantity.toString());
    
    if (formData.notes) {
      donationFormData.append('notes', formData.notes);
    }
    
    if (formData.photoFile) {
      donationFormData.append('photo', formData.photoFile);
    }

    return this.http.put<DonationResponse>(`${this.API_URL}/${donationId}`, donationFormData)
      .pipe(
        tap(response => {
          if (response.success) {
            // Refresh donations list
            this.loadUserDonations();
            console.log('✅ Donation updated:', donationId);
          }
        }),
        catchError(error => {
          console.error('Update donation error:', error);
          let errorMessage = 'Failed to update donation. Please try again.';
          
          if (error.status === 400) {
            errorMessage = error.error?.message || 'Invalid donation data.';
          } else if (error.status === 404) {
            errorMessage = 'Donation not found.';
          } else if (error.status === 403) {
            errorMessage = 'You can only edit pending donations.';
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // Delete donation (if allowed)
  deleteDonation(donationId: string): Observable<DonationResponse> {
    return this.http.delete<DonationResponse>(`${this.API_URL}/${donationId}`)
      .pipe(
        tap(response => {
          if (response.success) {
            // Remove from local state
            const currentDonations = this.donationsSubject.value;
            const updatedDonations = currentDonations.filter(d => d.id !== donationId);
            this.donationsSubject.next(updatedDonations);
            console.log('✅ Donation deleted:', donationId);
          }
        }),
        catchError(error => {
          console.error('Delete donation error:', error);
          let errorMessage = 'Failed to delete donation. Please try again.';
          
          if (error.status === 403) {
            errorMessage = 'You can only delete pending donations.';
          } else if (error.status === 404) {
            errorMessage = 'Donation not found.';
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // Search donations with advanced filters
  searchDonations(searchRequest: DonationSearchRequest): Observable<PaginatedDonationResponse> {
    let params = new HttpParams()
      .set('page', (searchRequest.page || 0).toString())
      .set('size', (searchRequest.size || 10).toString());

    if (searchRequest.query) {
      params = params.set('query', searchRequest.query);
    }
    if (searchRequest.status) {
      params = params.set('status', searchRequest.status);
    }
    if (searchRequest.condition) {
      params = params.set('condition', searchRequest.condition);
    }
    if (searchRequest.dateFrom) {
      params = params.set('dateFrom', searchRequest.dateFrom);
    }
    if (searchRequest.dateTo) {
      params = params.set('dateTo', searchRequest.dateTo);
    }

    return this.http.get<PaginatedDonationResponse>(`${this.API_URL}/search`, { params })
      .pipe(
        map(response => ({
          ...response,
          content: response.content.map(donation => ({
            ...donation,
            submissionDate: new Date(donation.submissionDate),
            statusUpdatedDate: donation.statusUpdatedDate ? new Date(donation.statusUpdatedDate) : undefined
          }))
        })),
        catchError(error => {
          console.error('Search donations error:', error);
          return throwError(() => error);
        })
      );
  }

  // Get donation statistics
getDonationStatistics(): Observable<DonationStatistics> {
  const currentUser = this.authService.getCurrentUser();
  if (!currentUser) {
    return throwError(() => new Error('User not authenticated'));
  }

  const params = new HttpParams().set('memberId', currentUser.memberId);

  return this.http.get<DonationStatistics>(`${this.API_URL}/statistics`, { params })
    .pipe(
      catchError(error => {
        console.error('Get donation statistics error:', error);
        // Return default statistics with proper typing
        const defaultStats: DonationStatistics = {
          totalDonations: 0,
          pendingDonations: 0,
          acceptedDonations: 0,
          rejectedDonations: 0,
          donationsByCondition: {},
          donationsByMonth: []
        };
        return of(defaultStats);  // ✅ Use of() instead of new Observable
      })
    );
}


  // Get donation conditions (static data)
  getDonationConditions(): DonationCondition[] {
    return [
      { value: 'New', label: 'New', description: 'Brand new, never used' },
      { value: 'Like New', label: 'Like New', description: 'Excellent condition, minimal wear' },
      { value: 'Good', label: 'Good', description: 'Good condition, some wear' },
      { value: 'Fair', label: 'Fair', description: 'Readable condition, noticeable wear' },
      { value: 'Poor', label: 'Poor', description: 'Heavily worn but still usable' }
    ];
  }

  // Admin functions (for library staff)
  updateDonationStatus(donationId: string, status: DonationStatus, adminNotes?: string): Observable<DonationResponse> {
    return this.http.patch<DonationResponse>(`${this.API_URL}/${donationId}/status`, {
      status,
      adminNotes
    }).pipe(
      tap(response => {
        if (response.success) {
          // Refresh donations list
          this.loadUserDonations();
          console.log(`✅ Donation ${donationId} status updated to: ${status}`);
        }
      }),
      catchError(error => {
        console.error('Update donation status error:', error);
        return throwError(() => error);
      })
    );
  }

  // Get all donations (admin function)
  getAllDonations(page: number = 0, size: number = 10, status?: DonationStatus): Observable<PaginatedDonationResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<PaginatedDonationResponse>(`${this.API_URL}/all`, { params })
      .pipe(
        map(response => ({
          ...response,
          content: response.content.map(donation => ({
            ...donation,
            submissionDate: new Date(donation.submissionDate),
            statusUpdatedDate: donation.statusUpdatedDate ? new Date(donation.statusUpdatedDate) : undefined
          }))
        })),
        catchError(error => {
          console.error('Get all donations error:', error);
          return throwError(() => error);
        })
      );
  }

  // Refresh donations (manual refresh)
  refreshDonations(): void {
    this.loadUserDonations();
  }

  // Get current donations from BehaviorSubject
  getCurrentDonations(): Donation[] {
    return this.donationsSubject.value;
  }
}
