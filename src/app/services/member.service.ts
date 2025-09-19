import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap,map } from 'rxjs/operators';
import { 
  Member,
  MemberRegistrationRequest, 
  MemberRegistrationResponse, 
  CountryCode,
  MemberProfile,
  UpdateProfileRequest
} from '../models/member.model';

@Injectable({
  providedIn: 'root'
})
export class MemberService {
  private readonly API_URL = 'http://localhost:8080/api/members';
  
  constructor(private http: HttpClient) {}

  // Register new member
  registerMember(memberData: MemberRegistrationRequest): Observable<MemberRegistrationResponse> {
    return this.http.post<MemberRegistrationResponse>(`${this.API_URL}/register`, memberData)
      .pipe(
        tap(response => {
          if (response.success) {
            console.log('Member registered successfully:', response.memberId);
          }
        }),
        catchError(error => {
          console.error('Registration error:', error);
          let errorMessage = 'Registration failed. Please try again.';
          
          if (error.status === 400) {
            errorMessage = error.error?.message || 'Invalid registration data.';
          } else if (error.status === 409) {
            errorMessage = 'Email or mobile number already exists.';
          } else if (error.status === 422) {
            errorMessage = 'Validation failed. Please check your input.';
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // Get member profile by ID
  getMemberById(memberId: string): Observable<Member> {
    return this.http.get<Member>(`${this.API_URL}/${memberId}`)
      .pipe(
        catchError(error => {
          console.error('Get member error:', error);
          return throwError(() => error);
        })
      );
  }

  // Get member profile by email
  getMemberByEmail(email: string): Observable<Member> {
    const params = new HttpParams().set('email', email);
    return this.http.get<Member>(`${this.API_URL}/by-email`, { params })
      .pipe(
        catchError(error => {
          console.error('Get member by email error:', error);
          return throwError(() => error);
        })
      );
  }

  // Update member profile
  updateMemberProfile(memberId: string, updateData: UpdateProfileRequest): Observable<Member> {
    return this.http.put<Member>(`${this.API_URL}/${memberId}/profile`, updateData)
      .pipe(
        tap(updatedMember => {
          console.log('Member profile updated:', updatedMember.id);
        }),
        catchError(error => {
          console.error('Update profile error:', error);
          let errorMessage = 'Failed to update profile. Please try again.';
          
          if (error.status === 400) {
            errorMessage = error.error?.message || 'Invalid profile data.';
          } else if (error.status === 404) {
            errorMessage = 'Member not found.';
          } else if (error.status === 409) {
            errorMessage = 'Email or mobile number already exists.';
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // Check if email exists
  checkEmailExists(email: string): Observable<{ exists: boolean }> {
    const params = new HttpParams().set('email', email);
    return this.http.get<{ exists: boolean }>(`${this.API_URL}/check-email`, { params })
      .pipe(
        catchError(error => {
          console.error('Check email error:', error);
          return throwError(() => error);
        })
      );
  }

  // Check if mobile exists
  checkMobileExists(countryCode: string, mobileNumber: string): Observable<{ exists: boolean }> {
    const params = new HttpParams()
      .set('countryCode', countryCode)
      .set('mobileNumber', mobileNumber);
    
    return this.http.get<{ exists: boolean }>(`${this.API_URL}/check-mobile`, { params })
      .pipe(
        catchError(error => {
          console.error('Check mobile error:', error);
          return throwError(() => error);
        })
      );
  }

  // Update password
  updatePassword(memberId: string, currentPassword: string, newPassword: string): Observable<{ success: boolean; message: string }> {
    return this.http.put<{ success: boolean; message: string }>(`${this.API_URL}/${memberId}/password`, {
      currentPassword,
      newPassword
    }).pipe(
      catchError(error => {
        console.error('Update password error:', error);
        let errorMessage = 'Failed to update password. Please try again.';
        
        if (error.status === 400) {
          errorMessage = 'Current password is incorrect.';
        } else if (error.status === 404) {
          errorMessage = 'Member not found.';
        }
        
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  // Reset password (for forgot password flow)
  resetPassword(email: string, newPassword: string, resetToken?: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.API_URL}/reset-password`, {
      email,
      newPassword,
      resetToken
    }).pipe(
      catchError(error => {
        console.error('Reset password error:', error);
        return throwError(() => error);
      })
    );
  }

  // Get member statistics
  getMemberStatistics(): Observable<{
    totalMembers: number;
    activeMembers: number;
    newMembersToday: number;
  }> {
    return this.http.get<{
      totalMembers: number;
      activeMembers: number;
      newMembersToday: number;
    }>(`${this.API_URL}/statistics`)
      .pipe(
        catchError(error => {
          console.error('Get statistics error:', error);
          return throwError(() => error);
        })
      );
  }

  // Search members (admin functionality)
  searchMembers(query?: string, page: number = 0, size: number = 10): Observable<{
    content: Member[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
  }> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    if (query) {
      params = params.set('query', query);
    }

    return this.http.get<{
      content: Member[];
      totalElements: number;
      totalPages: number;
      size: number;
      number: number;
    }>(`${this.API_URL}/search`, { params })
      .pipe(
        catchError(error => {
          console.error('Search members error:', error);
          return throwError(() => error);
        })
      );
  }

  // Deactivate member account
  deactivateMember(memberId: string): Observable<{ success: boolean; message: string }> {
    return this.http.put<{ success: boolean; message: string }>(`${this.API_URL}/${memberId}/deactivate`, {})
      .pipe(
        catchError(error => {
          console.error('Deactivate member error:', error);
          return throwError(() => error);
        })
      );
  }

  // Activate member account
  activateMember(memberId: string): Observable<{ success: boolean; message: string }> {
    return this.http.put<{ success: boolean; message: string }>(`${this.API_URL}/${memberId}/activate`, {})
      .pipe(
        catchError(error => {
          console.error('Activate member error:', error);
          return throwError(() => error);
        })
      );
  }

  // Get country codes (static data - can be cached)
  getCountryCodes(): Observable<CountryCode[]> {
    return this.http.get<CountryCode[]>(`${this.API_URL}/country-codes`)
      .pipe(
        catchError(error => {
          console.error('Get country codes error:', error);
          // Fallback to static data
          return this.getStaticCountryCodes();
        })
      );
  }

  // Fallback static country codes
  private getStaticCountryCodes(): Observable<CountryCode[]> {
    const staticCodes: CountryCode[] = [
      { code: 'IN', name: 'India', dialCode: '+91' },
      { code: 'US', name: 'United States', dialCode: '+1' },
      { code: 'GB', name: 'United Kingdom', dialCode: '+44' },
      { code: 'CA', name: 'Canada', dialCode: '+1' },
      { code: 'AU', name: 'Australia', dialCode: '+61' },
      { code: 'DE', name: 'Germany', dialCode: '+49' },
      { code: 'FR', name: 'France', dialCode: '+33' },
      { code: 'JP', name: 'Japan', dialCode: '+81' },
      { code: 'CN', name: 'China', dialCode: '+86' },
      { code: 'BR', name: 'Brazil', dialCode: '+55' }
    ];
    
    return new Observable(observer => {
      observer.next(staticCodes);
      observer.complete();
    });
  }

  // Legacy methods for backward compatibility (will be removed in future versions)
  
  /**
 * @deprecated Use checkEmailExists instead
 */
existsByEmail(email: string): Observable<boolean> {
  console.warn('existsByEmail is deprecated, use checkEmailExists instead');
  
  return this.checkEmailExists(email).pipe(
    map((response: { exists: boolean }) => response.exists), // Extract boolean from response
    catchError((error: any) => {
      console.error('Error in deprecated existsByEmail:', error);
      return of(false);
    })
  );
}


/**
 * @deprecated Use checkMobileExists instead
 */
existsByMobile(countryCode: string, mobileNumber: string): Observable<boolean> {
  console.warn('existsByMobile is deprecated, use checkMobileExists instead');
  
  return this.checkMobileExists(countryCode, mobileNumber).pipe(
    map((response: any) => {
      // Explicit boolean check
      if (response && typeof response === 'object') {
        return response.exists === true;
      }
      return false;
    }),
    catchError(() => of(false))
  );
}





  /**
 * @deprecated Use getMemberByEmail instead
 */
findUserByEmail(email: string): Observable<Member | null> {
  console.warn('findUserByEmail is deprecated, use getMemberByEmail instead');
  return this.getMemberByEmail(email).pipe(
    catchError(() => of(null))  // Use 'of(null)' instead of creating new Observable
  );
}


  /**
   * @deprecated Authentication should be handled by AuthService
   */
  validateCredentials(email: string, password: string): Observable<boolean> {
    console.warn('validateCredentials is deprecated, use AuthService.login instead');
    return new Observable(observer => {
      observer.next(false);
      observer.complete();
    });
  }
}
