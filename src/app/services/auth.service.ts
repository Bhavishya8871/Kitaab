import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { AuthUser, LoginRequest, LoginResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // ✅ Mock mode - no HTTP calls
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private isBrowser: boolean;

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      setTimeout(() => this.loadStoredUser(), 0);
    }
  }

  private loadStoredUser(): void {
    if (!this.isBrowser || !window.localStorage) return;

    try {
      const storedUser = window.localStorage.getItem('currentUser');
      const storedToken = window.localStorage.getItem('authToken');
      
      if (storedToken && storedUser) {
        const user: AuthUser = JSON.parse(storedUser);
        this.currentUserSubject.next(user);
        console.log('✅ Restored mock user session:', user.memberName);
      }
    } catch (error) {
      console.error('Error loading stored user:', error);
    }
  }

  // ✅ MOCK LOGIN - Works without backend
  login(credentials: LoginRequest): Observable<LoginResponse> {
    console.log('🔄 Mock login starting for:', credentials.email);
    
    return new Observable(observer => {
      // Simulate network delay
      setTimeout(() => {
        if (credentials.email && credentials.password) {
          const mockUser: AuthUser = {
            memberId: 'MOCK' + Math.floor(Math.random() * 1000),
            memberName: credentials.email.split('@')[0], // Extract name from email
            email: credentials.email,
            role: 'MEMBER',
            membershipDate: new Date().toISOString(),
            phone: '+91-9876543210',
            address: 'Mock Address, Library City'
          };

          const mockToken = 'mock-jwt-token-' + Date.now();
          
          // Store data in localStorage
          if (this.isBrowser && window.localStorage) {
            window.localStorage.setItem('authToken', mockToken);
            window.localStorage.setItem('currentUser', JSON.stringify(mockUser));
          }

          // Update current user
          this.currentUserSubject.next(mockUser);

          const response: LoginResponse = {
            success: true,
            message: 'Login successful',
            token: mockToken,
            user: mockUser
          };

          console.log('✅ Mock login successful:', response);
          observer.next(response);
          observer.complete();
        } else {
          // Invalid credentials
          const errorResponse: LoginResponse = {
            success: false,
            message: 'Please enter valid email and password'
          };
          observer.next(errorResponse);
          observer.complete();
        }
      }, 1500); // 1.5 second delay to simulate network
    });
  }

  // ✅ MOCK FORGOT PASSWORD
  forgotPassword(email: string): Observable<{ success: boolean; message: string }> {
    console.log('🔄 Mock forgot password for:', email);
    
    return new Observable(observer => {
      setTimeout(() => {
        if (email && email.includes('@')) {
          observer.next({ 
            success: true, 
            message: 'Security question sent (mock)' 
          });
        } else {
          observer.next({ 
            success: false, 
            message: 'Email not found in our records' 
          });
        }
        observer.complete();
      }, 1000);
    });
  }

  // ✅ MOCK VERIFY SECRET ANSWER
  verifySecretAnswer(email: string, answer: string): Observable<{ success: boolean; message: string }> {
    console.log('🔄 Mock verify secret answer for:', email);
    
    return new Observable(observer => {
      setTimeout(() => {
        // Accept any non-empty answer
        if (answer && answer.trim().length > 0) {
          observer.next({ 
            success: true, 
            message: 'Answer verified successfully' 
          });
        } else {
          observer.next({ 
            success: false, 
            message: 'Incorrect answer. Please try again.' 
          });
        }
        observer.complete();
      }, 1000);
    });
  }

  // ✅ MOCK RESET PASSWORD
  resetPassword(email: string, newPassword: string, resetToken?: string): Observable<{ success: boolean; message: string }> {
    console.log('🔄 Mock reset password for:', email);
    
    return new Observable(observer => {
      setTimeout(() => {
        if (newPassword && newPassword.length >= 6) {
          observer.next({ 
            success: true, 
            message: 'Password reset successfully' 
          });
        } else {
          observer.next({ 
            success: false, 
            message: 'Password must be at least 6 characters long' 
          });
        }
        observer.complete();
      }, 1000);
    });
  }

  // ✅ MOCK GET USER PROFILE
  getUserProfile(): Observable<AuthUser> {
    return new Observable(observer => {
      setTimeout(() => {
        const user = this.getCurrentUser();
        if (user) {
          observer.next(user);
        } else {
          observer.error(new Error('No user logged in'));
        }
        observer.complete();
      }, 500);
    });
  }

  // ✅ MOCK UPDATE PROFILE
  updateUserProfile(updatedData: Partial<AuthUser>): Observable<AuthUser> {
    return new Observable(observer => {
      setTimeout(() => {
        const currentUser = this.getCurrentUser();
        if (currentUser) {
          const updatedUser = { ...currentUser, ...updatedData };
          this.currentUserSubject.next(updatedUser);
          
          // Update localStorage
          if (this.isBrowser && window.localStorage) {
            window.localStorage.setItem('currentUser', JSON.stringify(updatedUser));
          }
          
          observer.next(updatedUser);
        } else {
          observer.error(new Error('No user logged in'));
        }
        observer.complete();
      }, 1000);
    });
  }

  // ✅ MOCK REFRESH TOKEN
  refreshToken(): Observable<{ token: string }> {
    return new Observable(observer => {
      setTimeout(() => {
        const newToken = 'mock-refreshed-token-' + Date.now();
        if (this.isBrowser && window.localStorage) {
          window.localStorage.setItem('authToken', newToken);
        }
        observer.next({ token: newToken });
        observer.complete();
      }, 500);
    });
  }

  // ✅ Helper methods (same as original)
  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    if (!this.isBrowser || !window.localStorage) return null;
    try {
      return window.localStorage.getItem('authToken');
    } catch (error) {
      return null;
    }
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser();
    return !!(token && user);
  }

  logout(): void {
    if (this.isBrowser && window.localStorage) {
      window.localStorage.removeItem('authToken');
      window.localStorage.removeItem('currentUser');
    }
    this.currentUserSubject.next(null);
    console.log('👋 Mock user logged out');
    this.router.navigate(['/login']);
  }
}

// backend ready file 


// import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
// import { HttpClient } from '@angular/common/http';
// import { BehaviorSubject, Observable, throwError } from 'rxjs';
// import { Router } from '@angular/router';
// import { catchError, tap } from 'rxjs/operators';
// import { isPlatformBrowser } from '@angular/common';
// import { AuthUser, LoginRequest, LoginResponse } from '../models/auth.model';

// @Injectable({
//   providedIn: 'root'
// })
// export class AuthService {
//   private readonly API_URL = 'http://localhost:8080/api/auth';
//   private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
//   public currentUser$ = this.currentUserSubject.asObservable();
//   private isBrowser: boolean;

//   constructor(
//     private http: HttpClient,
//     private router: Router,
//     @Inject(PLATFORM_ID) private platformId: Object
//   ) {
//     this.isBrowser = isPlatformBrowser(this.platformId);
//     if (this.isBrowser) {
//       // Defer localStorage access to avoid SSR issues
//       setTimeout(() => this.loadStoredUser(), 0);
//     }
//   }

//   private loadStoredUser(): void {
//     if (!this.isBrowser || typeof window === 'undefined' || !window.localStorage) {
//       return;
//     }

//     try {
//       const token = window.localStorage.getItem('authToken');
//       if (token && this.isTokenValid(token)) {
//         // Get user data from token or make API call to get user profile
//         this.getUserProfile().subscribe({
//           next: (user) => this.currentUserSubject.next(user),
//           error: () => this.logout()
//         });
//       }
//     } catch (error) {
//       console.error('Error loading stored user:', error);
//       this.clearTokens();
//     }
//   }

//   private clearTokens(): void {
//     if (this.isBrowser && typeof window !== 'undefined' && window.localStorage) {
//       try {
//         window.localStorage.removeItem('authToken');
//       } catch (error) {
//         console.error('Error clearing tokens:', error);
//       }
//     }
//   }

//   private setToken(token: string): void {
//     if (this.isBrowser && typeof window !== 'undefined' && window.localStorage) {
//       try {
//         window.localStorage.setItem('authToken', token);
//       } catch (error) {
//         console.error('Error setting token:', error);
//       }
//     }
//   }

//   login(credentials: LoginRequest): Observable<LoginResponse> {
//     return this.http.post<LoginResponse>(`${this.API_URL}/login`, credentials)
//       .pipe(
//         tap(response => {
//           if (response.success && response.token && response.user) {
//             this.setToken(response.token);
//             this.currentUserSubject.next(response.user); // ✅ Safe now
//           } else if (response.success && response.token) {
//             // Handle case where login succeeds but user data is missing
//             this.setToken(response.token);
//             this.currentUserSubject.next(null);
//           }
//         }),
//         catchError(error => {
//           console.error('Login error:', error);
//           return throwError(() => error);
//         })
//       );
//   }

//   getUserProfile(): Observable<AuthUser> {
//     return this.http.get<AuthUser>(`${this.API_URL}/profile`)
//       .pipe(
//         catchError(error => {
//           console.error('Get profile error:', error);
//           return throwError(() => error);
//         })
//       );
//   }

//   forgotPassword(email: string): Observable<{ success: boolean; message: string }> {
//     return this.http.post<{ success: boolean; message: string }>(`${this.API_URL}/forgot-password`, { email })
//       .pipe(
//         catchError(error => {
//           console.error('Forgot password error:', error);
//           return throwError(() => error);
//         })
//       );
//   }

//   verifySecretAnswer(email: string, answer: string): Observable<{ success: boolean; message: string }> {
//     return this.http.post<{ success: boolean; message: string }>(`${this.API_URL}/verify-secret`, { email, answer })
//       .pipe(
//         catchError(error => {
//           console.error('Verify secret error:', error);
//           return throwError(() => error);
//         })
//       );
//   }

//   resetPassword(email: string, newPassword: string, resetToken?: string): Observable<{ success: boolean; message: string }> {
//     return this.http.post<{ success: boolean; message: string }>(`${this.API_URL}/reset-password`, { 
//       email, 
//       newPassword, 
//       resetToken 
//     }).pipe(
//       catchError(error => {
//         console.error('Reset password error:', error);
//         return throwError(() => error);
//       })
//     );
//   }

//   updateUserProfile(updatedData: Partial<AuthUser>): Observable<AuthUser> {
//     return this.http.put<AuthUser>(`${this.API_URL}/profile`, updatedData)
//       .pipe(
//         tap(user => this.currentUserSubject.next(user)),
//         catchError(error => {
//           console.error('Update profile error:', error);
//           return throwError(() => error);
//         })
//       );
//   }

//   refreshToken(): Observable<{ token: string }> {
//     return this.http.post<{ token: string }>(`${this.API_URL}/refresh`, {})
//       .pipe(
//         tap(response => {
//           this.setToken(response.token);
//         }),
//         catchError(error => {
//           console.error('Refresh token error:', error);
//           this.logout();
//           return throwError(() => error);
//         })
//       );
//   }

//   getCurrentUser(): AuthUser | null {
//     return this.currentUserSubject.value;
//   }

//   // ✅ Keep same method name for interceptor compatibility
//   getToken(): string | null {
//     if (!this.isBrowser || typeof window === 'undefined' || !window.localStorage) {
//       return null;
//     }
    
//     try {
//       return window.localStorage.getItem('authToken');
//     } catch (error) {
//       console.error('Error getting token:', error);
//       return null;
//     }
//   }

//   isLoggedIn(): boolean {
//     const token = this.getToken();
//     return token !== null && this.isTokenValid(token);
//   }

//   private isTokenValid(token: string): boolean {
//     try {
//       const payload = JSON.parse(atob(token.split('.')[1]));
//       const currentTime = Math.floor(Date.now() / 1000);
//       return payload.exp > currentTime;
//     } catch (error) {
//       return false;
//     }
//   }

//   logout(): void {
//     this.clearTokens();
//     this.currentUserSubject.next(null);
//     this.router.navigate(['/login']);
//   }
// }
