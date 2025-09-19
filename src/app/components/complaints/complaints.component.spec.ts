import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { ComplaintsComponent } from './complaints.component';
import { ComplaintService } from '../../services/complaint.service';
import { AuthService } from '../../services/auth.service';
import { of } from 'rxjs';

describe('ComplaintsComponent', () => {
  let component: ComplaintsComponent;
  let fixture: ComponentFixture<ComplaintsComponent>;
  let complaintServiceSpy: jasmine.SpyObj<ComplaintService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    const complaintSpy = jasmine.createSpyObj('ComplaintService', [
      'submitComplaint', 
      'getUserComplaints', 
      'getComplaintStats',
      'handleComplaintAction'
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
      imports: [ComplaintsComponent, ReactiveFormsModule, RouterTestingModule],
      providers: [
        { provide: ComplaintService, useValue: complaintSpy },
        { provide: AuthService, useValue: authSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ComplaintsComponent);
    component = fixture.componentInstance;
    complaintServiceSpy = TestBed.inject(ComplaintService) as jasmine.SpyObj<ComplaintService>;
    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;

    // Setup mock returns
    complaintServiceSpy.getUserComplaints.and.returnValue(of({
      complaints: [],
      totalCount: 0
    }));
    complaintServiceSpy.getComplaintStats.and.returnValue(of({
      'Open': 0,
      'In Progress': 0,
      'Resolved': 0,
      'Closed': 0
    }));

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize complaint form', () => {
    expect(component.complaintForm).toBeDefined();
    expect(component.complaintForm.get('category')).toBeTruthy();
    expect(component.complaintForm.get('title')).toBeTruthy();
    expect(component.complaintForm.get('description')).toBeTruthy();
    expect(component.complaintForm.get('contactPreference')).toBeTruthy();
  });

  it('should validate form fields correctly', () => {
    const categoryControl = component.complaintForm.get('category');
    const titleControl = component.complaintForm.get('title');
    
    categoryControl?.setValue('');
    titleControl?.setValue('');
    
    expect(component.isFormValid()).toBeFalsy();
    
    categoryControl?.setValue('Library Service');
    titleControl?.setValue('Test complaint title');
    
    expect(categoryControl?.valid).toBeTruthy();
  });

  it('should load user complaints on init', () => {
    expect(complaintServiceSpy.getUserComplaints).toHaveBeenCalled();
    expect(complaintServiceSpy.getComplaintStats).toHaveBeenCalled();
  });
});
