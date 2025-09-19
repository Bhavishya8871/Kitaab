import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { FinesComponent } from './fines.component';
import { FineService } from '../../services/fine.service';
import { AuthService } from '../../services/auth.service';
import { of } from 'rxjs';

describe('FinesComponent', () => {
  let component: FinesComponent;
  let fixture: ComponentFixture<FinesComponent>;
  let fineServiceSpy: jasmine.SpyObj<FineService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    const fineSpy = jasmine.createSpyObj('FineService', [
      'getUserFines', 
      'getUserPayments', 
      'processPayment',
      'getPaymentMethods'
    ]);
    const authSpy = jasmine.createSpyObj('AuthService', ['getCurrentUser'], {
      currentUser$: of({
        memberId: 'TEST001',
        memberName: 'Test User',
        email: 'test@example.com',
        token: 'test-token',
        loginTime: new Date()
      })
    });

    await TestBed.configureTestingModule({
      imports: [FinesComponent, ReactiveFormsModule, RouterTestingModule],
      providers: [
        { provide: FineService, useValue: fineSpy },
        { provide: AuthService, useValue: authSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FinesComponent);
    component = fixture.componentInstance;
    fineServiceSpy = TestBed.inject(FineService) as jasmine.SpyObj<FineService>;
    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;

    // Setup mock returns
    fineServiceSpy.getUserFines.and.returnValue(of([]));
    fineServiceSpy.getUserPayments.and.returnValue(of([]));
    fineServiceSpy.getPaymentMethods.and.returnValue([]);

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize payment form', () => {
    expect(component.paymentForm).toBeDefined();
    expect(component.paymentForm.get('paymentMethod')).toBeTruthy();
  });

  it('should load user data on init', () => {
    expect(fineServiceSpy.getUserFines).toHaveBeenCalled();
    expect(fineServiceSpy.getUserPayments).toHaveBeenCalled();
  });
});
