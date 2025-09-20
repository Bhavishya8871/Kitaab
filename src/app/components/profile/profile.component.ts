import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { AuthUser } from '../../models/auth.model';
import { UserProfile, PasswordChangeRequest } from '../../models/user.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit, OnDestroy {
  profileForm!: FormGroup;
  currentUser: AuthUser | null = null;
  userProfile: UserProfile | null = null;

  passwordForm!: FormGroup;
  isChangingPassword = false;
  passwordChangeSuccess = '';
  passwordChangeError = '';

  isLoading = false;
  isEditing = false;
  isSaving = false;

  errorMessage = '';
  successMessage = '';

  // ✅ Hardcoded country codes
  countryCodes = [
    { code: 'IN', name: 'India', dialCode: '+91' },
    { code: 'US', name: 'United States', dialCode: '+1' },
    { code: 'GB', name: 'United Kingdom', dialCode: '+44' },
    { code: 'CA', name: 'Canada', dialCode: '+1' },
    { code: 'AU', name: 'Australia', dialCode: '+61' },
    { code: 'DE', name: 'Germany', dialCode: '+49' },
    { code: 'FR', name: 'France', dialCode: '+33' },
    { code: 'JP', name: 'Japan', dialCode: '+81' },
    { code: 'CN', name: 'China', dialCode: '+86' },
    { code: 'BR', name: 'Brazil', dialCode: '+55' },
    { code: 'RU', name: 'Russia', dialCode: '+7' },
    { code: 'ZA', name: 'South Africa', dialCode: '+27' },
    { code: 'AE', name: 'United Arab Emirates', dialCode: '+971' },
    { code: 'SG', name: 'Singapore', dialCode: '+65' }
  ];

  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private userService: UserService,
    public router: Router
  ) {
    this.initializeForm();
    this.initializePasswordForm();
  }

  ngOnInit(): void {
    this.loadCurrentUser();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private initializeForm(): void {
    this.profileForm = this.fb.group({
      memberName: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50),
        Validators.pattern(/^[a-zA-Z\s]+$/)
      ]],
      email: ['', [
        Validators.required,
        Validators.email
      ]],
      phone: ['', [
        Validators.pattern(/^\d{10}$/)
      ]],
      address: ['', [
        Validators.maxLength(200)
      ]]
    });
  }

  private loadCurrentUser(): void {
    this.subscriptions.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        if (user) {
          this.loadUserProfile(user.memberId);
        } else {
          this.router.navigate(['/login']);
        }
      })
    );
  }

  // Load user profile from backend
  private loadUserProfile(memberId: string): void {
    this.isLoading = true;
    
    this.subscriptions.add(
      this.userService.getUserProfile(memberId).subscribe({
        next: (profile) => {
          this.userProfile = profile;
          this.populateForm(profile);
          this.isLoading = false;
          console.log('✅ User profile loaded from backend:', profile);
        },
        error: (error) => {
          console.error('❌ Error loading user profile:', error);
          this.showError('Failed to load user profile. Please try again.');
          this.isLoading = false;
        }
      })
    );
  }

  private populateForm(profile: UserProfile): void {
    this.profileForm.patchValue({
      memberName: profile.memberName,
      email: profile.email,
      phone: profile.phone || '',
      address: profile.address || ''
    });
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    this.clearMessages();
    
    if (!this.isEditing && this.userProfile) {
      // Reset form to original values
      this.populateForm(this.userProfile);
    }
  }

  onSaveChanges(): void {
    if (this.profileForm.invalid) {
      this.showError('Please fill in all required fields correctly.');
      this.markFormGroupTouched();
      return;
    }

    if (!this.userProfile || !this.currentUser) {
      this.showError('User profile not found.');
      return;
    }

    this.isSaving = true;
    this.clearMessages();

    const formValue = this.profileForm.value;
    const updatedData = {
      memberName: formValue.memberName.trim(),
      email: formValue.email.trim().toLowerCase(),
      phone: formValue.phone?.trim(),
      address: formValue.address?.trim()
    };

    // Update profile via backend
    this.subscriptions.add(
      this.userService.updateUserProfile(this.currentUser.memberId, updatedData).subscribe({
        next: (updatedProfile) => {
          this.userProfile = updatedProfile;
          
          // Update auth service with new data
          this.authService.updateUserProfile({
            memberName: updatedProfile.memberName,
            email: updatedProfile.email
          });

          this.isEditing = false;
          this.isSaving = false;
          this.showSuccess('Your profile has been updated successfully.');
          console.log('✅ Profile updated successfully:', updatedProfile);
        },
        error: (error) => {
          console.error('❌ Error updating profile:', error);
          this.showError(error.message || 'Failed to update profile. Please try again.');
          this.isSaving = false;
        }
      })
    );
  }

  getFieldError(fieldName: string): string {
    const field = this.profileForm.get(fieldName);
    if (field && field.errors && field.touched) {
      const errors = field.errors;
      
      if (errors['required']) {
        return `${this.getFieldDisplayName(fieldName)} is required.`;
      }
      if (errors['email']) {
        return 'Please enter a valid email address.';
      }
      if (errors['minlength']) {
        return `${this.getFieldDisplayName(fieldName)} must be at least ${errors['minlength'].requiredLength} characters.`;
      }
      if (errors['maxlength']) {
        return `${this.getFieldDisplayName(fieldName)} cannot exceed ${errors['maxlength'].requiredLength} characters.`;
      }
      if (errors['pattern']) {
        if (fieldName === 'memberName') {
          return 'Name should contain only letters and spaces.';
        }
        if (fieldName === 'phone') {
          return 'Please enter a valid 10-digit mobile number.';
        }
      }
    }
    return '';
  }

  private getFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      memberName: 'Full Name',
      email: 'Email',
      phone: 'Phone Number',
      address: 'Address'
    };
    return displayNames[fieldName] || fieldName;
  }

  private markFormGroupTouched(): void {
    Object.keys(this.profileForm.controls).forEach(key => {
      const control = this.profileForm.get(key);
      control?.markAsTouched();
    });
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

  getCountryName(dialCode: string): string {
    const country = this.countryCodes.find(c => c.dialCode === dialCode);
    return country ? country.name : dialCode;
  }

  getMemberSince(): string {
    if (this.userProfile?.memberSince) {
      return new Date(this.userProfile.memberSince).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
      });
    }
    return 'Unknown';
  }

  // ✅ FIXED ROUTING METHODS - Match your app.routes.ts exactly
  navigateToMyBooks(): void {
    console.log('📖 Navigating to borrowed-returned');
    this.router.navigate(['/borrowed-returned']);
  }

  navigateToBorrowBooks(): void {
    console.log('📚 Navigating to borrow');
    this.router.navigate(['/borrow']);
  }

  navigateToViewBooks(): void {
    console.log('👀 Navigating to view');
    this.router.navigate(['/view']);
  }

  navigateToDonate(): void {
    console.log('🎁 Navigating to donate');
    this.router.navigate(['/donate']);
  }

  navigateToComplaints(): void {
    console.log('💬 Navigating to complaints');
    this.router.navigate(['/complaints']);
  }

  navigateToFines(): void {
    console.log('💳 Navigating to fines');
    this.router.navigate(['/fines']);
  }

  navigateToHome(): void {
    console.log('🏠 Navigating to homepage');
    this.router.navigate(['/homepage']);
  }

  logout(): void {
    console.log('👋 Logging out');
    this.authService.logout();
  }

  // Password change functionality with backend integration
  private initializePasswordForm(): void {
    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/)
      ]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  private passwordMatchValidator(group: FormGroup): { [key: string]: any } | null {
    const newPassword = group.get('newPassword');
    const confirmPassword = group.get('confirmPassword');
    
    if (!newPassword || !confirmPassword) {
      return null;
    }
    
    return newPassword.value === confirmPassword.value ? null : { passwordMismatch: true };
  }

  onChangePassword(): void {
    if (this.passwordForm.invalid) {
      this.showPasswordError('Please fill in all password fields correctly.');
      this.markPasswordFormTouched();
      return;
    }
    
    if (!this.currentUser) {
      this.showPasswordError('User not found.');
      return;
    }
    
    this.isChangingPassword = true;
    this.clearPasswordMessages();
    
    const passwordData: PasswordChangeRequest = {
      currentPassword: this.passwordForm.value.currentPassword,
      newPassword: this.passwordForm.value.newPassword,
      confirmPassword: this.passwordForm.value.confirmPassword
    };
    
    // Change password via backend
    this.subscriptions.add(
      this.userService.changePassword(this.currentUser.memberId, passwordData).subscribe({
        next: (response) => {
          if (response.success) {
            this.showPasswordSuccess(response.message);
            this.passwordForm.reset();
            console.log('✅ Password changed successfully');
          } else {
            this.showPasswordError(response.message);
          }
          this.isChangingPassword = false;
        },
        error: (error) => {
          console.error('❌ Error changing password:', error);
          this.showPasswordError(error.message || 'Failed to change password. Please try again.');
          this.isChangingPassword = false;
        }
      })
    );
  }

  getPasswordFieldError(fieldName: string): string {
    const field = this.passwordForm.get(fieldName);
    if (field && field.errors && field.touched) {
      const errors = field.errors;
      
      if (errors['required']) {
        return `${this.getPasswordFieldDisplayName(fieldName)} is required.`;
      }
      
      if (errors['minlength']) {
        return `${this.getPasswordFieldDisplayName(fieldName)} must be at least ${errors['minlength'].requiredLength} characters.`;
      }
      
      if (errors['pattern']) {
        return 'New password must contain uppercase, lowercase, number, and special character.';
      }
    }
    
    if (fieldName === 'confirmPassword' && this.passwordForm.errors?.['passwordMismatch']) {
      return 'Passwords do not match.';
    }
    
    return '';
  }

  private getPasswordFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      currentPassword: 'Current Password',
      newPassword: 'New Password',
      confirmPassword: 'Confirm Password'
    };
    return displayNames[fieldName] || fieldName;
  }

  private markPasswordFormTouched(): void {
    Object.keys(this.passwordForm.controls).forEach(key => {
      const control = this.passwordForm.get(key);
      control?.markAsTouched();
    });
  }

  private showPasswordError(message: string): void {
    this.passwordChangeError = message;
    this.passwordChangeSuccess = '';
    setTimeout(() => this.clearPasswordMessages(), 5000);
  }

  private showPasswordSuccess(message: string): void {
    this.passwordChangeSuccess = message;
    this.passwordChangeError = '';
    setTimeout(() => this.clearPasswordMessages(), 8000);
  }

  private clearPasswordMessages(): void {
    this.passwordChangeError = '';
    this.passwordChangeSuccess = '';
  }
}
