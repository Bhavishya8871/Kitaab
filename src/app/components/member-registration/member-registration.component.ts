import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { MemberService } from '../../services/member.service';
import { CountryCode, MemberRegistrationRequest, MemberRegistrationResponse, SecretQuestions } from '../../models/member.model';

@Component({
  selector: 'app-member-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './member-registration.component.html',
  styleUrls: ['./member-registration.component.css'],
})
export class MemberRegistrationComponent implements OnInit, OnDestroy {
  registrationForm!: FormGroup;
  countryCodes: CountryCode[] = [];
  isLoading = false;
  isLoadingCountries = false;
  showSuccessModal = false;
  registrationResponse: MemberRegistrationResponse | null = null;
  maxDate: string = '';

  // Real-time validation states
  emailTaken = false;
  mobileTaken = false;
  checkingEmail = false;
  checkingMobile = false;

  // Error handling
  errorMessage = '';
  validationErrors: any = {};

  secretQuestions = Object.values(SecretQuestions);

  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private memberService: MemberService,
    private router: Router
  ) {
    this.setMaxDate();
  }

  ngOnInit(): void {
    this.loadCountryCodes();
    this.initForm();
    this.setupRealTimeValidation();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadCountryCodes(): void {
    this.isLoadingCountries = true;
    this.subscriptions.add(
      this.memberService.getCountryCodes().subscribe({
        next: (codes) => {
          this.countryCodes = codes;
          this.isLoadingCountries = false;
        },
        error: (error) => {
          console.error('Error loading country codes:', error);
          this.isLoadingCountries = false;
          // Set default country codes as fallback
          this.countryCodes = [
            { code: 'IN', name: 'India', dialCode: '+91' },
            { code: 'US', name: 'United States', dialCode: '+1' },
            { code: 'GB', name: 'United Kingdom', dialCode: '+44' }
          ];
        }
      })
    );
  }

  private initForm(): void {
    this.registrationForm = this.fb.group(
      {
        memberName: ['', [Validators.required, Validators.maxLength(50), this.nameValidator()]],
        email: ['', [Validators.required, this.strictEmailValidator()]],
        countryCode: ['+91', Validators.required],
        mobileNumber: ['', [Validators.required, this.mobileValidator()]],
        address: ['', [Validators.required, Validators.maxLength(200)]],
        dateOfBirth: ['', [Validators.required, this.ageValidator(14)]],
        password: ['', [Validators.required, Validators.minLength(8), this.passwordValidator()]],
        confirmPassword: ['', Validators.required],
        secretQuestion: ['', Validators.required],
        secretAnswer: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
        acceptTerms: [false, Validators.requiredTrue]
      },
      {
        validators: this.confirmPasswordValidator('password', 'confirmPassword'),
      }
    );
  }

  private setupRealTimeValidation(): void {
    // Real-time email validation
    const emailControl = this.registrationForm.get('email');
    if (emailControl) {
      this.subscriptions.add(
        emailControl.valueChanges.pipe(
          debounceTime(500),
          distinctUntilChanged()
        ).subscribe(email => {
          if (email && emailControl.valid && !emailControl.hasError('invalidEmail')) {
            this.checkEmailAvailability(email.trim().toLowerCase());
          } else {
            this.emailTaken = false;
            this.checkingEmail = false;
          }
        })
      );
    }

    // Real-time mobile validation
    const mobileControl = this.registrationForm.get('mobileNumber');
    const countryControl = this.registrationForm.get('countryCode');
    
    if (mobileControl && countryControl) {
      this.subscriptions.add(
        mobileControl.valueChanges.pipe(
          debounceTime(500),
          distinctUntilChanged()
        ).subscribe(mobile => {
          if (mobile && mobileControl.valid) {
            const countryCode = countryControl.value;
            this.checkMobileAvailability(countryCode, mobile);
          } else {
            this.mobileTaken = false;
            this.checkingMobile = false;
          }
        })
      );

      // Also check when country code changes
      this.subscriptions.add(
        countryControl.valueChanges.subscribe(() => {
          const mobile = mobileControl.value;
          if (mobile && mobileControl.valid) {
            const countryCode = countryControl.value;
            this.checkMobileAvailability(countryCode, mobile);
          }
        })
      );
    }

    // Password confirmation validation
    this.subscriptions.add(
      this.registrationForm.get('password')?.valueChanges.subscribe(() => {
        this.registrationForm.get('confirmPassword')?.updateValueAndValidity();
      }) || new Subscription()
    );
  }

  private checkEmailAvailability(email: string): void {
    this.checkingEmail = true;
    this.emailTaken = false;

    this.subscriptions.add(
      this.memberService.checkEmailExists(email).subscribe({
        next: (response) => {
          this.emailTaken = response.exists;
          this.checkingEmail = false;
          
          const emailControl = this.registrationForm.get('email');
          if (this.emailTaken) {
            emailControl?.setErrors({ ...emailControl.errors, emailTaken: true });
          } else {
            // Remove emailTaken error if it exists
            const errors = emailControl?.errors;
            if (errors?.['emailTaken']) {
              delete errors['emailTaken'];
              emailControl?.setErrors(Object.keys(errors).length ? errors : null);
            }
          }
        },
        error: (error) => {
          console.error('Email check error:', error);
          this.checkingEmail = false;
          // Don't block registration if check fails
          this.emailTaken = false;
        }
      })
    );
  }

  private checkMobileAvailability(countryCode: string, mobileNumber: string): void {
    this.checkingMobile = true;
    this.mobileTaken = false;

    this.subscriptions.add(
      this.memberService.checkMobileExists(countryCode, mobileNumber).subscribe({
        next: (response) => {
          this.mobileTaken = response.exists;
          this.checkingMobile = false;
          
          const mobileControl = this.registrationForm.get('mobileNumber');
          if (this.mobileTaken) {
            mobileControl?.setErrors({ ...mobileControl.errors, mobileTaken: true });
          } else {
            // Remove mobileTaken error if it exists
            const errors = mobileControl?.errors;
            if (errors?.['mobileTaken']) {
              delete errors['mobileTaken'];
              mobileControl?.setErrors(Object.keys(errors).length ? errors : null);
            }
          }
        },
        error: (error) => {
          console.error('Mobile check error:', error);
          this.checkingMobile = false;
          // Don't block registration if check fails
          this.mobileTaken = false;
        }
      })
    );
  }

  private mobileValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value: string = control.value;
      if (!value) return null;

      // Remove any non-digits
      const digits = value.replace(/\D/g, '');
      
      // Check length
      if (digits.length !== 10) {
        return { invalidMobile: true };
      }

      // Check if starts with valid digits (6-9 for India)
      if (!/^[6-9]/.test(digits)) {
        return { invalidMobile: true };
      }

      // Check for invalid patterns
      const disallowedAllZeros = /^[6-9]0{9}$/;
      const repeatingDigitsRegex = /(.)\1{5,}/;

      if (disallowedAllZeros.test(digits)) {
        return { invalidMobilePattern: true };
      }

      if (repeatingDigitsRegex.test(digits)) {
        return { invalidMobilePattern: true };
      }

      return null;
    };
  }

  private nameValidator(): ValidatorFn {
    const regex = /^[A-Za-z ]{3,}$/;
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) return null;
      
      // Check for minimum 3 characters and only letters/spaces
      if (!regex.test(value.trim())) {
        return { invalidName: true };
      }

      // Check for too many consecutive spaces
      if (/\s{3,}/.test(value)) {
        return { invalidName: true };
      }

      return null;
    };
  }

  private ageValidator(minAge: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const val = control.value;
      if (!val) return null;
      
      const dob = new Date(val);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        return age - 1 >= minAge ? null : { ageTooLow: true };
      }
      
      return age >= minAge ? null : { ageTooLow: true };
    };
  }

  private passwordValidator(): ValidatorFn {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?#&])[A-Za-z\d@$!%*?#&]{8,}$/;
    return (control: AbstractControl): ValidationErrors | null => {
      const val = control.value;
      if (!val) return null;
      return regex.test(val) ? null : { weakPassword: true };
    };
  }

  private confirmPasswordValidator(passwordKey: string, confirmPasswordKey: string): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const password = group.get(passwordKey)?.value;
      const confirmPassword = group.get(confirmPasswordKey)?.value;
      
      if (password && confirmPassword && password !== confirmPassword) {
        const confirmControl = group.get(confirmPasswordKey);
        confirmControl?.setErrors({ passwordsMismatch: true });
        return { passwordsMismatch: true };
      }
      
      // Clear the error if passwords match
      const confirmControl = group.get(confirmPasswordKey);
      if (confirmControl?.hasError('passwordsMismatch') && password === confirmPassword) {
        const errors = confirmControl.errors;
        if (errors) {
          delete errors['passwordsMismatch'];
          confirmControl.setErrors(Object.keys(errors).length ? errors : null);
        }
      }
      
      return null;
    };
  }

  private strictEmailValidator(): ValidatorFn {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) return null;
      return regex.test(value.trim()) ? null : { invalidEmail: true };
    };
  }

  private setMaxDate(): void {
    const today = new Date();
    const minAge = 14;
    const maxDate = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
    this.maxDate = maxDate.toISOString().split('T')[0];
  }

  getFieldError(fieldName: string): string {
    const control = this.registrationForm.get(fieldName);
    if (!control || !control.touched || !control.errors) return '';

    const errors = control.errors;

    if (errors['required'])
      return `${this.getFriendlyName(fieldName)} is required.`;
    if (errors['email'] || errors['invalidEmail'])
      return `Please enter a valid email address.`;
    if (errors['emailTaken'])
      return `This email is already registered. Please use a different email.`;
    if (errors['invalidName'])
      return `Name must contain at least 3 letters and only alphabets/spaces.`;
    if (errors['invalidMobile'])
      return `Please enter a valid 10-digit mobile number starting with 6-9.`;
    if (errors['invalidMobilePattern'])
      return `Mobile number contains invalid pattern.`;
    if (errors['mobileTaken'])
      return `This mobile number is already registered.`;
    if (errors['ageTooLow'])
      return `You must be at least 14 years old to register.`;
    if (errors['weakPassword'])
      return `Password must contain uppercase, lowercase, number, and special character.`;
    if (errors['passwordsMismatch'])
      return `Passwords do not match.`;
    if (errors['minlength'])
      return `${this.getFriendlyName(fieldName)} is too short (minimum ${errors['minlength'].requiredLength} characters).`;
    if (errors['maxlength'])
      return `${this.getFriendlyName(fieldName)} is too long (maximum ${errors['maxlength'].requiredLength} characters).`;

    return `Invalid ${this.getFriendlyName(fieldName)}.`;
  }

  private getFriendlyName(field: string): string {
    const map: Record<string, string> = {
      memberName: 'Name',
      email: 'Email',
      countryCode: 'Country Code',
      mobileNumber: 'Mobile Number',
      address: 'Address',
      dateOfBirth: 'Date of Birth',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      secretQuestion: 'Security Question',
      secretAnswer: 'Security Answer',
    };
    return map[field] || field;
  }

  onSubmit(): void {
    if (this.registrationForm.invalid) {
      this.markAllTouched();
      this.errorMessage = 'Please fix all validation errors before submitting.';
      return;
    }

    if (this.emailTaken || this.mobileTaken) {
      this.errorMessage = 'Please resolve duplicate email or mobile number issues.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.validationErrors = {};

    const formValue = this.registrationForm.value;
    const data: MemberRegistrationRequest = {
      memberName: formValue.memberName.trim(),
      email: formValue.email.trim().toLowerCase(),
      countryCode: formValue.countryCode,
      mobileNumber: formValue.mobileNumber.replace(/\D/g, ''), // Remove non-digits
      address: formValue.address.trim(),
      dateOfBirth: formValue.dateOfBirth,
      password: formValue.password,
      secretQuestion: formValue.secretQuestion,
      secretAnswer: formValue.secretAnswer.trim(),
      acceptTerms: formValue.acceptTerms
    };

    this.subscriptions.add(
      this.memberService.registerMember(data).subscribe({
        next: (response) => {
          console.log('Registration successful:', response);
          this.registrationResponse = response;
          this.showSuccessModal = true;
          this.isLoading = false;
          
          // Clear form after successful registration
          this.registrationForm.reset();
          this.registrationForm.patchValue({ countryCode: '+91' });
        },
        error: (error) => {
          console.error('Registration error:', error);
          this.isLoading = false;
          
          if (error.status === 400 && error.error?.validationErrors) {
            // Handle validation errors from backend
            this.validationErrors = error.error.validationErrors;
            this.errorMessage = 'Please fix the validation errors below.';
          } else if (error.status === 409) {
            this.errorMessage = 'Email or mobile number already exists. Please use different credentials.';
          } else if (error.status === 422) {
            this.errorMessage = 'Invalid data provided. Please check all fields.';
          } else if (error.status === 0) {
            this.errorMessage = 'Unable to connect to server. Please check your internet connection.';
          } else {
            this.errorMessage = error.message || 'Registration failed. Please try again later.';
          }
        }
      })
    );
  }

  onReset(): void {
    this.registrationForm.reset();
    this.registrationForm.patchValue({ 
      countryCode: '+91',
      acceptTerms: false 
    });
    this.emailTaken = false;
    this.mobileTaken = false;
    this.checkingEmail = false;
    this.checkingMobile = false;
    this.errorMessage = '';
    this.validationErrors = {};
  }

  private markAllTouched(): void {
    Object.values(this.registrationForm.controls).forEach((control) => {
      control.markAsTouched();
    });
  }

  closeSuccessModal(): void {
    this.showSuccessModal = false;
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  clearError(): void {
    this.errorMessage = '';
  }

  get isFormValid(): boolean {
    return this.registrationForm.valid && 
           !this.emailTaken && 
           !this.mobileTaken && 
           !this.checkingEmail && 
           !this.checkingMobile;
  }

  get emailValidationStatus(): string {
    if (this.checkingEmail) return 'checking';
    if (this.emailTaken) return 'taken';
    const emailControl = this.registrationForm.get('email');
    if (emailControl?.valid && emailControl.value) return 'available';
    return '';
  }

  get mobileValidationStatus(): string {
    if (this.checkingMobile) return 'checking';
    if (this.mobileTaken) return 'taken';
    const mobileControl = this.registrationForm.get('mobileNumber');
    if (mobileControl?.valid && mobileControl.value) return 'available';
    return '';
  }
}
