import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError,of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { 
  FineRecord, 
  PaymentRecord, 
  PaymentMethodInfo,
  PaymentRequest,
  PaymentResponse,
  DummyPaymentForm,
  PaymentMethod,
  FineStatistics,
  PaginatedFineResponse,
  FineSearchRequest
} from '../models/fine.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class FineService {
  private readonly API_URL = 'http://localhost:8080/api/fines';
  private readonly PAYMENT_URL = 'http://localhost:8080/api/payments';
  
  // BehaviorSubject for real-time updates
  private finesSubject = new BehaviorSubject<FineRecord[]>([]);
  public fines$ = this.finesSubject.asObservable();

  private paymentsSubject = new BehaviorSubject<PaymentRecord[]>([]);
  public payments$ = this.paymentsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Load user data on service initialization
    this.loadUserData();
  }

  // Load user's fines and payments
  private loadUserData(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      // Load fines
      this.getUserFines(currentUser.memberId).subscribe({
        next: (fines) => {
          this.finesSubject.next(fines);
        },
        error: (error) => {
          console.error('Error loading user fines:', error);
          this.finesSubject.next([]);
        }
      });

      // Load payments
      this.getUserPayments(currentUser.memberId).subscribe({
        next: (payments) => {
          this.paymentsSubject.next(payments);
        },
        error: (error) => {
          console.error('Error loading user payments:', error);
          this.paymentsSubject.next([]);
        }
      });
    }
  }

  // Get user's outstanding fines
  getUserFines(memberId: string): Observable<FineRecord[]> {
    const params = new HttpParams().set('memberId', memberId);
    
    return this.http.get<FineRecord[]>(`${this.API_URL}/user`, { params })
      .pipe(
        map(fines => fines.map(fine => ({
          ...fine,
          dueDate: new Date(fine.dueDate),
          calculatedDate: new Date(fine.calculatedDate)
        }))),
        catchError(error => {
          console.error('Get user fines error:', error);
          return throwError(() => error);
        })
      );
  }

  // Get user's payment history
  getUserPayments(memberId: string, page: number = 0, size: number = 10): Observable<PaymentRecord[]> {
    let params = new HttpParams()
      .set('memberId', memberId)
      .set('page', page.toString())
      .set('size', size.toString());
    
    return this.http.get<PaginatedFineResponse<PaymentRecord>>(`${this.PAYMENT_URL}/user`, { params })
      .pipe(
        map(response => response.content.map(payment => ({
          ...payment,
          paymentDate: new Date(payment.paymentDate),
          fineRecords: payment.fineRecords.map(fine => ({
            ...fine,
            dueDate: new Date(fine.dueDate),
            calculatedDate: new Date(fine.calculatedDate)
          }))
        }))),
        catchError(error => {
          console.error('Get user payments error:', error);
          return throwError(() => error);
        })
      );
  }

  // Process payment for selected fines
  processPayment(paymentRequest: PaymentRequest, paymentForm: DummyPaymentForm): Observable<PaymentResponse> {
    const requestData = {
      ...paymentRequest,
      paymentDetails: {
        ...paymentForm,
        // Remove sensitive data - this would be handled securely on backend
        cardNumber: paymentForm.cardNumber ? '**** **** **** ' + paymentForm.cardNumber.slice(-4) : undefined
      }
    };

    return this.http.post<PaymentResponse>(`${this.PAYMENT_URL}/process`, requestData)
      .pipe(
        tap(response => {
          if (response.success) {
            // Refresh user data to reflect payment
            this.loadUserData();
            console.log('✅ Payment processed:', response.paymentId);
          }
        }),
        catchError(error => {
          console.error('Payment processing error:', error);
          let errorMessage = 'Payment processing failed. Please try again.';
          
          if (error.status === 400) {
            errorMessage = error.error?.message || 'Invalid payment data.';
          } else if (error.status === 401) {
            errorMessage = 'Authentication required. Please log in again.';
          } else if (error.status === 402) {
            errorMessage = 'Payment declined. Please check your payment details.';
          } else if (error.status === 409) {
            errorMessage = 'Some fines have already been paid or are being processed.';
          } else if (error.status === 0) {
            errorMessage = 'Unable to connect to payment gateway. Please try again.';
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // Get fine statistics
  getFineStatistics(memberId: string): Observable<FineStatistics> {
  const params = new HttpParams().set('memberId', memberId);

  return this.http.get<FineStatistics>(`${this.API_URL}/statistics`, { params })
    .pipe(
      catchError(error => {
        console.error('Get fine statistics error:', error);
        // Return default statistics with proper typing
        const defaultStats: FineStatistics = {
          totalOutstandingFines: 0,
          totalOverdueBooks: 0,
          totalPaidFines: 0,
          averageDaysOverdue: 0,
          finesByMonth: [],
          paymentHistory: []
        };
        return of(defaultStats);  // ✅ Use of() instead of new Observable
      })
    );
}


  // Search fines with advanced filters
  searchFines(searchRequest: FineSearchRequest): Observable<PaginatedFineResponse<FineRecord>> {
    let params = new HttpParams()
      .set('page', (searchRequest.page || 0).toString())
      .set('size', (searchRequest.size || 10).toString());

    if (searchRequest.memberId) {
      params = params.set('memberId', searchRequest.memberId);
    }
    if (searchRequest.status) {
      params = params.set('status', searchRequest.status);
    }
    if (searchRequest.dateFrom) {
      params = params.set('dateFrom', searchRequest.dateFrom);
    }
    if (searchRequest.dateTo) {
      params = params.set('dateTo', searchRequest.dateTo);
    }
    if (searchRequest.minAmount !== undefined) {
      params = params.set('minAmount', searchRequest.minAmount.toString());
    }
    if (searchRequest.maxAmount !== undefined) {
      params = params.set('maxAmount', searchRequest.maxAmount.toString());
    }

    return this.http.get<PaginatedFineResponse<FineRecord>>(`${this.API_URL}/search`, { params })
      .pipe(
        map(response => ({
          ...response,
          content: response.content.map(fine => ({
            ...fine,
            dueDate: new Date(fine.dueDate),
            calculatedDate: new Date(fine.calculatedDate)
          }))
        })),
        catchError(error => {
          console.error('Search fines error:', error);
          return throwError(() => error);
        })
      );
  }

  // Get payment by ID
  getPaymentById(paymentId: string): Observable<PaymentRecord> {
    return this.http.get<PaymentRecord>(`${this.PAYMENT_URL}/${paymentId}`)
      .pipe(
        map(payment => ({
          ...payment,
          paymentDate: new Date(payment.paymentDate),
          fineRecords: payment.fineRecords.map(fine => ({
            ...fine,
            dueDate: new Date(fine.dueDate),
            calculatedDate: new Date(fine.calculatedDate)
          }))
        })),
        catchError(error => {
          console.error('Get payment by ID error:', error);
          return throwError(() => error);
        })
      );
  }

  // Generate and download receipt
  downloadReceipt(payment: PaymentRecord): void {
    const receiptData = this.generateReceiptData(payment);
    this.downloadFile(receiptData, `receipt-${payment.transactionId}.txt`);
  }

  private generateReceiptData(payment: PaymentRecord): string {
    let receipt = `
LIBRARY FINE PAYMENT RECEIPT
============================

Transaction ID: ${payment.transactionId}
Payment ID: ${payment.paymentId}
Date: ${payment.paymentDate.toLocaleString()}
Status: ${payment.status.toUpperCase()}

Member Information:
------------------
Name: ${payment.memberName}
Member ID: ${payment.memberId}

Payment Details:
---------------
Method: ${payment.paymentMethod.toUpperCase()}
Amount: ₹${payment.amount}

Fine Details:
------------
`;

    payment.fineRecords.forEach((fine, index) => {
      receipt += `${index + 1}. ${fine.bookTitle}
   Author: ${fine.author}
   Days Overdue: ${fine.daysOverdue}
   Fine Amount: ₹${fine.totalFine}

`;
    });

    receipt += `
Total Amount Paid: ₹${payment.amount}

Thank you for your payment!
Generated on: ${new Date().toLocaleString()}
`;

    return receipt;
  }

  private downloadFile(data: string, filename: string): void {
    const blob = new Blob([data], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // Get available payment methods
  getPaymentMethods(): PaymentMethodInfo[] {
    return [
      {
        id: 'card',
        name: 'Credit/Debit Card',
        description: 'Pay using your credit or debit card',
        icon: '💳',
        processingTime: 'Instant',
        isEnabled: true
      },
      {
        id: 'upi',
        name: 'UPI Payment',
        description: 'Pay using UPI ID or QR code',
        icon: '📱',
        processingTime: 'Instant',
        isEnabled: true
      },
      {
        id: 'netbanking',
        name: 'Net Banking',
        description: 'Pay through your bank account',
        icon: '🏦',
        processingTime: '2-3 minutes',
        isEnabled: true
      },
      {
        id: 'wallet',
        name: 'Digital Wallet',
        description: 'Pay using digital wallets',
        icon: '👛',
        processingTime: 'Instant',
        isEnabled: true
      }
    ];
  }

  // Validate payment method data
  validatePaymentData(paymentMethod: string, formData: DummyPaymentForm): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (paymentMethod) {
      case 'card':
        if (!formData.cardNumber || formData.cardNumber.replace(/\s/g, '').length < 13) {
          errors.push('Invalid card number');
        }
        if (!formData.cardName || formData.cardName.trim().length < 2) {
          errors.push('Cardholder name is required');
        }
        if (!formData.expiryMonth || !formData.expiryYear) {
          errors.push('Expiry date is required');
        }
        if (!formData.cvv || formData.cvv.length < 3) {
          errors.push('Valid CVV is required');
        }
        break;

      case 'upi':
        if (!formData.upiId || !formData.upiId.includes('@')) {
          errors.push('Valid UPI ID is required');
        }
        break;

      case 'netbanking':
        if (!formData.bankName) {
          errors.push('Bank selection is required');
        }
        break;

      case 'wallet':
        if (!formData.walletProvider) {
          errors.push('Wallet provider selection is required');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Admin functions
  updateFineStatus(fineId: string, status: 'PAID' | 'WAIVED' | 'PENDING', adminNotes?: string): Observable<{ success: boolean; message: string }> {
    return this.http.patch<{ success: boolean; message: string }>(`${this.API_URL}/${fineId}/status`, {
      status,
      adminNotes
    }).pipe(
      tap(response => {
        if (response.success) {
          // Refresh user data
          this.loadUserData();
          console.log(`✅ Fine ${fineId} status updated to: ${status}`);
        }
      }),
      catchError(error => {
        console.error('Update fine status error:', error);
        return throwError(() => error);
      })
    );
  }

  // Get all fines (admin function)
  getAllFines(page: number = 0, size: number = 10, status?: string): Observable<PaginatedFineResponse<FineRecord>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<PaginatedFineResponse<FineRecord>>(`${this.API_URL}/all`, { params })
      .pipe(
        map(response => ({
          ...response,
          content: response.content.map(fine => ({
            ...fine,
            dueDate: new Date(fine.dueDate),
            calculatedDate: new Date(fine.calculatedDate)
          }))
        })),
        catchError(error => {
          console.error('Get all fines error:', error);
          return throwError(() => error);
        })
      );
  }

  // Recalculate fines (trigger backend calculation)
  recalculateFines(memberId?: string): Observable<{ success: boolean; message: string; updatedCount: number }> {
    const params = memberId ? new HttpParams().set('memberId', memberId) : new HttpParams();
    
    return this.http.post<{ success: boolean; message: string; updatedCount: number }>(`${this.API_URL}/recalculate`, {}, { params })
      .pipe(
        tap(response => {
          if (response.success) {
            // Refresh data after recalculation
            this.loadUserData();
            console.log(`✅ Recalculated fines: ${response.updatedCount} records updated`);
          }
        }),
        catchError(error => {
          console.error('Recalculate fines error:', error);
          return throwError(() => error);
        })
      );
  }

  // Refresh data (manual refresh)
  refreshData(): void {
    this.loadUserData();
  }

  // Get current fines from BehaviorSubject
  getCurrentFines(): FineRecord[] {
    return this.finesSubject.value;
  }

  // Get current payments from BehaviorSubject
  getCurrentPayments(): PaymentRecord[] {
    return this.paymentsSubject.value;
  }
}
