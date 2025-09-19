import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { DonateBooksComponent } from './donate-books.component';
import { AuthService } from '../../services/auth.service';
import { StorageService } from '../../services/storage.service';
import { of } from 'rxjs';

describe('DonateBooksComponent', () => {
  let component: DonateBooksComponent;
  let fixture: ComponentFixture<DonateBooksComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let storageServiceSpy: jasmine.SpyObj<StorageService>;

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj('AuthService', ['getCurrentUser'], {
      currentUser$: of({
        memberId: 'TEST001',
        memberName: 'Test User',
        email: 'test@example.com',
        token: 'test-token',
        loginTime: new Date()
      })
    });

    const storageSpy = jasmine.createSpyObj('StorageService', ['getItem', 'setItem']);

    await TestBed.configureTestingModule({
      imports: [DonateBooksComponent, ReactiveFormsModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: StorageService, useValue: storageSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DonateBooksComponent);
    component = fixture.componentInstance;
    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    storageServiceSpy = TestBed.inject(StorageService) as jasmine.SpyObj<StorageService>;
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with correct validators', () => {
    expect(component.donationForm.get('title')?.hasError('required')).toBeTruthy();
    expect(component.donationForm.get('author')?.hasError('required')).toBeTruthy();
    expect(component.donationForm.get('condition')?.hasError('required')).toBeTruthy();
  });

  it('should show confirmation modal on valid form submission', () => {
    component.donationForm.patchValue({
      title: 'Test Book',
      author: 'Test Author',
      condition: 'Good',
      quantity: 1
    });

    component.onSubmitDonation();
    expect(component.showConfirmation).toBeTruthy();
  });
});
