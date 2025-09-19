import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError,of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { 
  Complaint, 
  ComplaintFormData, 
  ComplaintResponse, 
  ComplaintListResponse,
  ComplaintAction,
  ComplaintStatus,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintSearchRequest,
  ComplaintStatistics,
  PaginatedComplaintResponse
} from '../models/complaint.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ComplaintService {
  private readonly API_URL = 'http://localhost:8080/api/complaints';
  
  // BehaviorSubject for real-time updates
  private complaintsSubject = new BehaviorSubject<Complaint[]>([]);
  public complaints$ = this.complaintsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Load user complaints on service initialization
    this.loadUserComplaints();
  }

  // Load user's complaints and update BehaviorSubject
  private loadUserComplaints(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.getUserComplaints().subscribe({
        next: (response) => {
          this.complaintsSubject.next(response.complaints);
        },
        error: (error) => {
          console.error('Error loading user complaints:', error);
          this.complaintsSubject.next([]);
        }
      });
    }
  }

  // Submit new complaint
  submitComplaint(formData: ComplaintFormData): Observable<ComplaintResponse> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return throwError(() => new Error('User not authenticated. Please log in and try again.'));
    }

    const complaintRequest = {
      ...formData,
      memberId: currentUser.memberId
    };

    return this.http.post<ComplaintResponse>(`${this.API_URL}`, complaintRequest)
      .pipe(
        tap(response => {
          if (response.success) {
            // Refresh complaints list to include new complaint
            this.loadUserComplaints();
            console.log('✅ Complaint submitted:', response.complaintId);
          }
        }),
        catchError(error => {
          console.error('Submit complaint error:', error);
          let errorMessage = 'Failed to submit complaint. Please try again.';
          
          if (error.status === 400) {
            errorMessage = error.error?.message || 'Invalid complaint data.';
          } else if (error.status === 401) {
            errorMessage = 'Authentication required. Please log in again.';
          } else if (error.status === 422) {
            errorMessage = 'Validation failed. Please check your input.';
          } else if (error.status === 0) {
            errorMessage = 'Unable to connect to server. Please check your connection.';
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // Get complaints for current user with pagination
  getUserComplaints(page: number = 0, size: number = 10, status?: ComplaintStatus): Observable<ComplaintListResponse> {
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

    return this.http.get<PaginatedComplaintResponse>(`${this.API_URL}/user`, { params })
      .pipe(
        map(response => ({
          complaints: response.content.map(complaint => ({
            ...complaint,
            submissionDate: new Date(complaint.submissionDate),
            lastUpdated: new Date(complaint.lastUpdated)
          })),
          totalCount: response.totalElements,
          totalPages: response.totalPages,
          currentPage: response.number
        })),
        catchError(error => {
          console.error('Get user complaints error:', error);
          return throwError(() => error);
        })
      );
  }

  // Get complaint by ID
  getComplaintById(complaintId: string): Observable<Complaint> {
    return this.http.get<Complaint>(`${this.API_URL}/${complaintId}`)
      .pipe(
        map(complaint => ({
          ...complaint,
          submissionDate: new Date(complaint.submissionDate),
          lastUpdated: new Date(complaint.lastUpdated)
        })),
        catchError(error => {
          console.error('Get complaint by ID error:', error);
          return throwError(() => error);
        })
      );
  }

  // Update complaint (for editing open complaints)
  updateComplaint(complaintId: string, formData: ComplaintFormData): Observable<ComplaintResponse> {
    return this.http.put<ComplaintResponse>(`${this.API_URL}/${complaintId}`, formData)
      .pipe(
        tap(response => {
          if (response.success) {
            // Refresh complaints list
            this.loadUserComplaints();
            console.log('✅ Complaint updated:', complaintId);
          }
        }),
        catchError(error => {
          console.error('Update complaint error:', error);
          let errorMessage = 'Failed to update complaint. Please try again.';
          
          if (error.status === 400) {
            errorMessage = error.error?.message || 'Invalid complaint data.';
          } else if (error.status === 404) {
            errorMessage = 'Complaint not found.';
          } else if (error.status === 403) {
            errorMessage = 'You can only edit open complaints.';
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // Handle complaint actions (confirm resolution, reopen, etc.)
  handleComplaintAction(action: ComplaintAction): Observable<ComplaintResponse> {
    return this.http.post<ComplaintResponse>(`${this.API_URL}/${action.complaintId}/action`, {
      action: action.action,
      notes: action.notes
    }).pipe(
      tap(response => {
        if (response.success) {
          // Refresh complaints list
          this.loadUserComplaints();
          console.log('✅ Complaint action processed:', action.action);
        }
      }),
      catchError(error => {
        console.error('Handle complaint action error:', error);
        let errorMessage = 'Unable to process the request. Please try again later.';
        
        if (error.status === 400) {
          errorMessage = error.error?.message || 'Invalid action.';
        } else if (error.status === 404) {
          errorMessage = 'Complaint not found.';
        } else if (error.status === 409) {
          errorMessage = 'Action not allowed for current complaint status.';
        }
        
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  // Update complaint status (admin function)
  updateComplaintStatus(complaintId: string, status: ComplaintStatus, notes?: string): Observable<ComplaintResponse> {
    return this.http.patch<ComplaintResponse>(`${this.API_URL}/${complaintId}/status`, {
      status,
      notes
    }).pipe(
      tap(response => {
        if (response.success) {
          // Refresh complaints list
          this.loadUserComplaints();
          console.log(`✅ Complaint ${complaintId} status updated to: ${status}`);
        }
      }),
      catchError(error => {
        console.error('Update complaint status error:', error);
        return throwError(() => error);
      })
    );
  }

  // Search complaints with advanced filters
  searchComplaints(searchRequest: ComplaintSearchRequest): Observable<PaginatedComplaintResponse> {
    let params = new HttpParams()
      .set('page', (searchRequest.page || 0).toString())
      .set('size', (searchRequest.size || 10).toString());

    if (searchRequest.query) {
      params = params.set('query', searchRequest.query);
    }
    if (searchRequest.category) {
      params = params.set('category', searchRequest.category);
    }
    if (searchRequest.status) {
      params = params.set('status', searchRequest.status);
    }
    if (searchRequest.priority) {
      params = params.set('priority', searchRequest.priority);
    }
    if (searchRequest.dateFrom) {
      params = params.set('dateFrom', searchRequest.dateFrom);
    }
    if (searchRequest.dateTo) {
      params = params.set('dateTo', searchRequest.dateTo);
    }

    return this.http.get<PaginatedComplaintResponse>(`${this.API_URL}/search`, { params })
      .pipe(
        map(response => ({
          ...response,
          content: response.content.map(complaint => ({
            ...complaint,
            submissionDate: new Date(complaint.submissionDate),
            lastUpdated: new Date(complaint.lastUpdated)
          }))
        })),
        catchError(error => {
          console.error('Search complaints error:', error);
          return throwError(() => error);
        })
      );
  }

  // Get complaint statistics
  getComplaintStatistics(): Observable<ComplaintStatistics> {
  const currentUser = this.authService.getCurrentUser();
  if (!currentUser) {
    return throwError(() => new Error('User not authenticated'));
  }

  const params = new HttpParams().set('memberId', currentUser.memberId);

  return this.http.get<ComplaintStatistics>(`${this.API_URL}/statistics`, { params })
    .pipe(
      catchError(error => {
        console.error('Get complaint statistics error:', error);
        // Return default statistics with proper typing
        const defaultStats: ComplaintStatistics = {
          totalComplaints: 0,
          openComplaints: 0,
          inProgressComplaints: 0,
          resolvedComplaints: 0,
          closedComplaints: 0,
          escalatedComplaints: 0,  // Add if needed based on your interface
          averageResolutionTime: 0,
          complaintsByCategory: {},
          complaintsByPriority: {}
        };
        return of(defaultStats);  // ✅ Use of() instead of new Observable
      })
    );
}


  // Add response to complaint
  addComplaintResponse(complaintId: string, response: string): Observable<ComplaintResponse> {
    return this.http.post<ComplaintResponse>(`${this.API_URL}/${complaintId}/response`, {
      response
    }).pipe(
      tap(res => {
        if (res.success) {
          this.loadUserComplaints();
        }
      }),
      catchError(error => {
        console.error('Add complaint response error:', error);
        return throwError(() => error);
      })
    );
  }

  // Get complaint categories (static or from backend)
  getComplaintCategories(): Observable<ComplaintCategory[]> {
  return this.http.get<ComplaintCategory[]>(`${this.API_URL}/categories`)
    .pipe(
      catchError(error => {
        console.error('Get categories error:', error);
        // Return static categories as fallback
        const categories: ComplaintCategory[] = [
          'Library Service',
          'Borrowing Process',
          'Payment Issues',
          'Book Condition',
          'Staff Behavior',
          'System Technical',
          'Facility Issues',
          'Other'
        ];
        return of(categories);  // ✅ Use of() instead of new Observable
      })
    );
}


  // Delete complaint (if allowed)
  deleteComplaint(complaintId: string): Observable<ComplaintResponse> {
    return this.http.delete<ComplaintResponse>(`${this.API_URL}/${complaintId}`)
      .pipe(
        tap(response => {
          if (response.success) {
            // Remove from local state
            const currentComplaints = this.complaintsSubject.value;
            const updatedComplaints = currentComplaints.filter(c => c.id !== complaintId);
            this.complaintsSubject.next(updatedComplaints);
            console.log('✅ Complaint deleted:', complaintId);
          }
        }),
        catchError(error => {
          console.error('Delete complaint error:', error);
          let errorMessage = 'Failed to delete complaint. Please try again.';
          
          if (error.status === 403) {
            errorMessage = 'You can only delete open complaints.';
          } else if (error.status === 404) {
            errorMessage = 'Complaint not found.';
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // Refresh complaints (manual refresh)
  refreshComplaints(): void {
    this.loadUserComplaints();
  }

  // Get current complaints from BehaviorSubject
  getCurrentComplaints(): Complaint[] {
    return this.complaintsSubject.value;
  }

  // Helper method to determine priority based on category
  static determinePriority(category: ComplaintCategory): ComplaintPriority {
    switch (category) {
      case 'Payment Issues':
      case 'System Technical':
        return 'High';
      case 'Staff Behavior':
      case 'Facility Issues':
        return 'Medium';
      case 'Book Condition':
      case 'Library Service':
        return 'Medium';
      case 'Borrowing Process':
        return 'Low';
      default:
        return 'Low';
    }
  }

  // Legacy methods for backward compatibility
  
  /**
   * @deprecated Use getComplaintStatistics instead
   */
  getComplaintStats(): Observable<{[key in ComplaintStatus]: number}> {
  console.warn('getComplaintStats is deprecated, use getComplaintStatistics instead');
  return this.getComplaintStatistics().pipe(
    map(stats => ({
      'Open': stats.openComplaints,
      'In Progress': stats.inProgressComplaints,
      'Resolved': stats.resolvedComplaints,
      'Closed': stats.closedComplaints,
      'Escalated': stats.escalatedComplaints || 0  // ✅ Add missing property
    }))
  );
}
}
