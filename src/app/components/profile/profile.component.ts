import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { MemberService } from '../../services/member.service';
import { UserDataService } from '../../services/user-data.service';
import { AuthUser } from '../../models/auth.model';
import { 
  UserProfile, 
  PasswordChangeRequest, 
  UserPreferences,
  UserStatistics
} from '../../models/user.model';
import { CountryCode } from '../../models/member.model';
 

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit, OnDestroy {
  // Forms
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  preferencesForm!: FormGroup;

  // Data
  currentUser: AuthUser | null = null;
  userProfile: UserProfile | null = null;
  userStatistics: UserStatistics | null = null;
  countryCodes: CountryCode[] = [];

  // States
  isLoading = false;
  isEditing = false;
  isSaving = false;
  isChangingPassword = false;
  isLoadingStats = false;
  showPasswordSection = false;
  showPreferencesSection = false;
  showStatisticsSection = false;

  // Validation states
  emailExists = false;
  mobileExists = false;
  checkingEmail = false;
  checkingMobile = false;

  // Messages
  errorMessage = '';
  successMessage = '';
  passwordChangeSuccess = '';
  passwordChangeError = '';

  // File upload
  selectedProfilePicture: File | null = null;
  profilePicturePreview: string | null = null;
  isUploadingPicture = false;

  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private userService: UserService,
    private memberService: MemberService,
    private userDataService: UserDataService,
    public router: Router
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadCountryCodes();
    this.loadCurrentUser();
    this.setupRealTimeValidation();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private initializeForms(): void {
    // Profile form
    this.profileForm = this.fb.group({
      memberName: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50),
        this.nameValidator()
      ]],
      email: ['', [
        Validators.required,
        this.emailValidator()
      ]],
      phone: ['', [
        Validators.pattern(/^\d{10}$/)
      ]],
      address: ['', [
        Validators.maxLength(200)
      ]],
      dateOfBirth: ['']
    });

    // Password form
    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [
        Validators.required,
        Validators.minLength(8),
        this.passwordStrengthValidator()
      ]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    // Preferences form
    this.preferencesForm = this.fb.group({
      favoriteGenres: [[]],
      emailNotifications: [true],
      smsNotifications: [false],
      reminderDaysBeforeDue: [3, [Validators.min(1), Validators.max(7)]],
      overdueNotifications: [true],
      showReadingHistory: [true],
      showFavoriteBooks: [true],
      allowRecommendations: [true],
      monthlyGoal: [5, [Validators.min(1), Validators.max(50)]],
      yearlyGoal: [60, [Validators.min(1), Validators.max(500)]]
    });
  }

  private loadCountryCodes(): void {
    this.subscriptions.add(
      this.memberService.getCountryCodes().subscribe({
        next: (codes) => {
          this.countryCodes = codes;
        },
        error: (error) => {
          console.error('Error loading country codes:', error);
        }
      })
    );
  }

  private loadCurrentUser(): void {
    this.subscriptions.add(
      this.userDataService.userData$.subscribe(userData => {
        this.currentUser = userData.user;
        this.userStatistics = userData.statistics;
        
        if (userData.user) {
          this.loadUserProfile(userData.user.memberId);
        }
      })
    );
  }

  private loadUserProfile(memberId: string): void {
    this.isLoading = true;
    
    this.subscriptions.add(
      this.userService.getUserProfile(memberId).subscribe({
        next: (profile) => {
          this.userProfile = profile;
          this.populateForm(profile);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading user profile:', error);
          this.showError('Failed to load user profile. Please try again.');
          this.isLoading = false;
        }
      })
    );

    // Load user statistics
    this.loadUserStatistics(memberId);
  }

  private loadUserStatistics(memberId: string): void {
    this.isLoadingStats = true;
    
    this.subscriptions.add(
      this.userService.getUserStatistics(memberId).subscribe({
        next: (stats) => {
          this.userStatistics = stats;
          this.isLoadingStats = false;
        },
        error: (error) => {
          console.error('Error loading user statistics:', error);
          this.isLoadingStats = false;
        }
      })
    );
  }

  private populateForm(profile: UserProfile): void {
    this.profileForm.patchValue({
      memberName: profile.memberName,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      dateOfBirth: profile.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().split('T')[0] : ''
    });

    if (profile.preferences) {
      this.preferencesForm.patchValue({
        favoriteGenres: profile.preferences.favoriteGenres || [],
        emailNotifications: profile.preferences.notificationSettings?.emailNotifications ?? true,
        smsNotifications: profile.preferences.notificationSettings?.smsNotifications ?? false,
        reminderDaysBeforeDue: profile.preferences.notificationSettings?.reminderDaysBeforeDue ?? 3,
        overdueNotifications: profile.preferences.notificationSettings?.overdueNotifications ?? true,
        showReadingHistory: profile.preferences.privacySettings?.showReadingHistory ?? true,
        showFavoriteBooks: profile.preferences.privacySettings?.showFavoriteBooks ?? true,
        allowRecommendations: profile.preferences.privacySettings?.allowRecommendations ?? true,
        monthlyGoal: profile.preferences.readingGoals?.monthlyGoal ?? 5,
        yearlyGoal: profile.preferences.readingGoals?.yearlyGoal ?? 60
      });
    }

    if (profile.profilePictureUrl) {
      this.profilePicturePreview = profile.profilePictureUrl;
    }
  }

  private setupRealTimeValidation(): void {
    // Email validation
    const emailControl = this.profileForm.get('email');
    if (emailControl) {
      this.subscriptions.add(
        emailControl.valueChanges.pipe(
          debounceTime(500),
          distinctUntilChanged()
        ).subscribe(email => {
          if (email && emailControl.valid && email !== this.userProfile?.email) {
            this.checkEmailAvailability(email);
          } else {
            this.emailExists = false;
            this.checkingEmail = false;
          }
        })
      );
    }

    // Phone validation
    const phoneControl = this.profileForm.get('phone');
    if (phoneControl) {
      this.subscriptions.add(
        phoneControl.valueChanges.pipe(
          debounceTime(500),
          distinctUntilChanged()
        ).subscribe(phone => {
          if (phone && phoneControl.valid && phone !== this.userProfile?.phone) {
            this.checkMobileAvailability(phone);
          } else {
            this.mobileExists = false;
            this.checkingMobile = false;
          }
        })
      );
    }
  }

  private checkEmailAvailability(email: string): void {
    this.checkingEmail = true;
    this.emailExists = false;

    this.subscriptions.add(
      this.memberService.checkEmailExists(email).subscribe({
        next: (response) => {
          this.emailExists = response.exists;
          this.checkingEmail = false;
          
          const emailControl = this.profileForm.get('email');
          if (this.emailExists) {
            emailControl?.setErrors({ ...emailControl.errors, emailExists: true });
          } else {
            const errors = emailControl?.errors;
            if (errors?.['emailExists']) {
              delete errors['emailExists'];
              emailControl?.setErrors(Object.keys(errors).length ? errors : null);
            }
          }
        },
        error: (error) => {
          console.error('Email check error:', error);
          this.checkingEmail = false;
        }
      })
    );
  }

  private checkMobileAvailability(mobile: string): void {
    this.checkingMobile = true;
    this.mobileExists = false;

    this.subscriptions.add(
      this.memberService.checkMobileExists('+91', mobile).subscribe({
        next: (response) => {
          this.mobileExists = response.exists;
          this.checkingMobile = false;
          
          const phoneControl = this.profileForm.get('phone');
          if (this.mobileExists) {
            phoneControl?.setErrors({ ...phoneControl.errors, mobileExists: true });
          } else {
            const errors = phoneControl?.errors;
            if (errors?.['mobileExists']) {
              delete errors['mobileExists'];
              phoneControl?.setErrors(Object.keys(errors).length ? errors : null);
            }
          }
        },
        error: (error) => {
          console.error('Mobile check error:', error);
          this.checkingMobile = false;
        }
      })
    );
  }

  // Profile management
  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    this.clearMessages();
    
    if (!this.isEditing && this.userProfile) {
      this.populateForm(this.userProfile);
      this.selectedProfilePicture = null;
    }
  }

  onSaveChanges(): void {
    if (this.profileForm.invalid || this.checkingEmail || this.checkingMobile) {
      this.showError('Please fix all validation errors before saving.');
      this.markFormGroupTouched(this.profileForm);
      return;
    }

    if (this.emailExists || this.mobileExists) {
      this.showError('Email or mobile number already exists. Please use different credentials.');
      return;
    }

    if (!this.userProfile || !this.currentUser) {
      this.showError('User profile not found.');
      return;
    }

    this.isSaving = true;
    this.clearMessages();

    const formValue = this.profileForm.value;
    const profileData = {
      memberName: formValue.memberName.trim(),
      email: formValue.email.trim().toLowerCase(),
      phone: formValue.phone?.trim(),
      address: formValue.address?.trim(),
      dateOfBirth: formValue.dateOfBirth ? new Date(formValue.dateOfBirth) : undefined,
      preferences: this.buildPreferences()
    };

    this.subscriptions.add(
      this.userService.updateUserProfile(this.currentUser.memberId, profileData).subscribe({
        next: (updatedProfile) => {
          this.userProfile = updatedProfile;
          
          // Update auth user data
          this.authService.updateUserProfile({
            memberName: updatedProfile.memberName,
            email: updatedProfile.email
          });

          // Upload profile picture if selected
          if (this.selectedProfilePicture) {
            this.uploadProfilePicture();
          } else {
            this.completeProfileUpdate();
          }
        },
        error: (error) => {
          console.error('Update profile error:', error);
          this.showError(error.message || 'Failed to update profile. Please try again.');
          this.isSaving = false;
        }
      })
    );
  }

  private buildPreferences(): UserPreferences {
    const prefsValue = this.preferencesForm.value;
    return {
      favoriteGenres: prefsValue.favoriteGenres || [],
      notificationSettings: {
        emailNotifications: prefsValue.emailNotifications,
        smsNotifications: prefsValue.smsNotifications,
        reminderDaysBeforeDue: prefsValue.reminderDaysBeforeDue,
        overdueNotifications: prefsValue.overdueNotifications
      },
      privacySettings: {
        showReadingHistory: prefsValue.showReadingHistory,
        showFavoriteBooks: prefsValue.showFavoriteBooks,
        allowRecommendations: prefsValue.allowRecommendations
      },
      readingGoals: {
        monthlyGoal: prefsValue.monthlyGoal,
        yearlyGoal: prefsValue.yearlyGoal,
        currentStreak: this.userStatistics?.readingStreak || 0
      }
    };
  }

  private completeProfileUpdate(): void {
    this.isEditing = false;
    this.isSaving = false;
    this.selectedProfilePicture = null;
    this.showSuccess('Your profile has been updated successfully.');
    
    // Refresh user data
    this.userDataService.refreshUserData();
  }

  // Profile picture handling
  onProfilePictureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      // Validate file
      if (!file.type.startsWith('image/')) {
        this.showError('Please select a valid image file.');
        return;
      }

      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        this.showError('Image file size must be less than 2MB.');
        return;
      }

      this.selectedProfilePicture = file;

      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        this.profilePicturePreview = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removeProfilePicture(): void {
    this.selectedProfilePicture = null;
    this.profilePicturePreview = this.userProfile?.profilePictureUrl || null;
    
    // Reset file input
    const fileInput = document.getElementById('profilePictureInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  private uploadProfilePicture(): void {
    if (!this.selectedProfilePicture || !this.currentUser) {
      this.completeProfileUpdate();
      return;
    }

    this.isUploadingPicture = true;
    
    const formData = new FormData();
    formData.append('profilePicture', this.selectedProfilePicture);

    // Note: This would typically be a separate endpoint for file upload
    // For now, we'll simulate the upload completion
    setTimeout(() => {
      this.isUploadingPicture = false;
      this.completeProfileUpdate();
    }, 1000);
  }

  // Password management
  togglePasswordSection(): void {
    this.showPasswordSection = !this.showPasswordSection;
    if (!this.showPasswordSection) {
      this.passwordForm.reset();
      this.clearPasswordMessages();
    }
  }

  onChangePassword(): void {
    if (this.passwordForm.invalid) {
      this.showPasswordError('Please fill in all password fields correctly.');
      this.markFormGroupTouched(this.passwordForm);
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
    
    this.subscriptions.add(
      this.userService.changePassword(this.currentUser.memberId, passwordData).subscribe({
        next: (response) => {
          if (response.success) {
            this.showPasswordSuccess(response.message);
            this.passwordForm.reset();
            this.showPasswordSection = false;
          } else {
            this.showPasswordError(response.message);
          }
          this.isChangingPassword = false;
        },
        error: (error) => {
          this.showPasswordError(error.message || 'Failed to change password. Please try again.');
          this.isChangingPassword = false;
        }
      })
    );
  }

  // Sections toggle
  togglePreferencesSection(): void {
    this.showPreferencesSection = !this.showPreferencesSection;
  }

  toggleStatisticsSection(): void {
    this.showStatisticsSection = !this.showStatisticsSection;
  }

  // Form validation
  private nameValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value?.trim();
      if (!value) return null;
      
      if (!/^[A-Za-z\s]+$/.test(value)) {
        return { invalidName: true };
      }
      
      if (value.length < 2) {
        return { minlength: { requiredLength: 2, actualLength: value.length } };
      }
      
      return null;
    };
  }

  private emailValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value?.trim();
      if (!value) return null;
      
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
      if (!emailRegex.test(value)) {
        return { invalidEmail: true };
      }
      
      return null;
    };
  }

  private passwordStrengthValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) return null;
      
      const hasUpperCase = /[A-Z]/.test(value);
      const hasLowerCase = /[a-z]/.test(value);
      const hasNumbers = /\d/.test(value);
      const hasSpecialChar = /[@$!%*?&]/.test(value);
      
      if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
        return { weakPassword: true };
      }
      
      return null;
    };
  }

  private passwordMatchValidator(group: FormGroup): ValidationErrors | null {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      return { passwordMismatch: true };
    }
    
    return null;
  }

  // Error handling and validation
  getFieldError(fieldName: string): string {
    const field = this.profileForm.get(fieldName);
    if (!field || !field.errors || !field.touched) return '';

    const errors = field.errors;
    
    if (errors['required']) {
      return `${this.getFieldDisplayName(fieldName)} is required.`;
    }
    if (errors['invalidEmail']) {
      return 'Please enter a valid email address.';
    }
    if (errors['emailExists']) {
      return 'This email is already registered.';
    }
    if (errors['invalidName']) {
      return 'Name should contain only letters and spaces.';
    }
    if (errors['pattern']) {
      if (fieldName === 'phone') {
        return 'Please enter a valid 10-digit mobile number.';
      }
    }
    if (errors['mobileExists']) {
      return 'This mobile number is already registered.';
    }
    if (errors['minlength']) {
      return `${this.getFieldDisplayName(fieldName)} must be at least ${errors['minlength'].requiredLength} characters.`;
    }
    if (errors['maxlength']) {
      return `${this.getFieldDisplayName(fieldName)} cannot exceed ${errors['maxlength'].requiredLength} characters.`;
    }

    return '';
  }

  getPasswordFieldError(fieldName: string): string {
    const field = this.passwordForm.get(fieldName);
    if (!field || !field.errors || !field.touched) return '';

    const errors = field.errors;
    
    if (errors['required']) {
      return `${this.getPasswordFieldDisplayName(fieldName)} is required.`;
    }
    if (errors['minlength']) {
      return `${this.getPasswordFieldDisplayName(fieldName)} must be at least ${errors['minlength'].requiredLength} characters.`;
    }
    if (errors['weakPassword']) {
      return 'Password must contain uppercase, lowercase, number, and special character.';
    }
    
    if (fieldName === 'confirmPassword' && this.passwordForm.errors?.['passwordMismatch']) {
      return 'Passwords do not match.';
    }
    
    return '';
  }

  private getFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      memberName: 'Full Name',
      email: 'Email',
      phone: 'Mobile Number',
      address: 'Address',
      dateOfBirth: 'Date of Birth'
    };
    return displayNames[fieldName] || fieldName;
  }

  private getPasswordFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      currentPassword: 'Current Password',
      newPassword: 'New Password',
      confirmPassword: 'Confirm Password'
    };
    return displayNames[fieldName] || fieldName;
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  // Message handling
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

  // Utility methods
  getMemberSince(): string {
    if (this.userProfile?.memberSince) {
      return new Date(this.userProfile.memberSince).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
      });
    }
    return 'Unknown';
  }

  getAccountAge(): string {
    if (this.userProfile?.memberSince) {
      const memberSince = new Date(this.userProfile.memberSince);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - memberSince.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 30) {
        return `${diffDays} days`;
      } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months > 1 ? 's' : ''}`;
      } else {
        const years = Math.floor(diffDays / 365);
        return `${years} year${years > 1 ? 's' : ''}`;
      }
    }
    return 'Unknown';
  }

  getReadingProgress(): number {
    if (this.userStatistics && this.userStatistics.monthlyReadingGoal > 0) {
      return Math.min(100, (this.userStatistics.booksReadThisMonth / this.userStatistics.monthlyReadingGoal) * 100);
    }
    return 0;
  }

  // Navigation
  navigateToMyBooks(): void {
    this.router.navigate(['/my-books']);
  }

  navigateToBorrowBooks(): void {
    this.router.navigate(['/books']);
  }

  navigateToFines(): void {
    this.router.navigate(['/fines']);
  }

  logout(): void {
    this.authService.logout();
  }

  // Export user data
  exportUserData(format: 'JSON' | 'PDF' | 'CSV' = 'JSON'): void {
    if (!this.currentUser) return;

    this.subscriptions.add(
      this.userService.exportUserData(this.currentUser.memberId, format).subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `user_data_${this.currentUser!.memberId}.${format.toLowerCase()}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          this.showSuccess(`User data exported successfully as ${format}.`);
        },
        error: (error) => {
          console.error('Export error:', error);
          this.showError('Failed to export user data. Please try again.');
        }
      })
    );
  }

  // Validation status getters for template
  get emailValidationStatus(): string {
    if (this.checkingEmail) return 'checking';
    if (this.emailExists) return 'exists';
    const emailControl = this.profileForm.get('email');
    if (emailControl?.valid && emailControl.value) return 'available';
    return '';
  }

  get mobileValidationStatus(): string {
    if (this.checkingMobile) return 'checking';
    if (this.mobileExists) return 'exists';
    const phoneControl = this.profileForm.get('phone');
    if (phoneControl?.valid && phoneControl.value) return 'available';
    return '';
  }

  // Format helpers
  formatDate(date: Date | string): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date(date));
  }
}
