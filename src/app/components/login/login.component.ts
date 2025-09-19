import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LoginRequest } from '../../models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  showForgotPassword = false;
  returnUrl = '/homepage';

  // Forgot password flow properties
  forgotStage: 'email' | 'answer' | 'reset' = 'email';
  forgotForm!: FormGroup;
  forgotErrorMessage = '';
  forgotSuccessMessage = '';
  secretQuestionText = '';
  private tempUserEmail = '';
  private tempResetToken = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    // Check if user is already logged in
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/homepage']);
      return;
    }

    // Get return URL from route parameters or use default
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/homepage';
  }

  private initForm(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  private initForgotForm() {
    switch (this.forgotStage) {
      case 'email':
        this.forgotForm = this.fb.group({
          email: ['', [Validators.required, Validators.email]]
        });
        break;
      case 'answer':
        this.forgotForm = this.fb.group({
          answer: ['', [Validators.required]]
        });
        break;
      case 'reset':
        this.forgotForm = this.fb.group({
          newPassword: ['', [Validators.required, Validators.minLength(6)]]
        });
        break;
    }
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.clearMessages();

      const credentials: LoginRequest = {
        email: this.loginForm.value.email.trim().toLowerCase(),
        password: this.loginForm.value.password
      };

      this.authService.login(credentials).subscribe({
        next: (response) => {
          if (response.success) {
            this.showSuccess(`Welcome back, ${response.user?.memberName}! Redirecting...`);
            setTimeout(() => {
              this.router.navigate([this.returnUrl]);
            }, 1500);
          } else {
            this.isLoading = false;
            this.showError(response.message || 'Login failed. Please try again.');
          }
        },
        error: (error) => {
          this.isLoading = false;
          let errorMsg = 'Login failed. Please try again.';
          
          if (error.status === 401) {
            errorMsg = 'Invalid email or password.';
          } else if (error.status === 403) {
            errorMsg = 'Account is suspended. Please contact support.';
          } else if (error.status === 0) {
            errorMsg = 'Unable to connect to server. Please check your connection.';
          } else if (error.error?.message) {
            errorMsg = error.error.message;
          }
          
          this.showError(errorMsg);
        }
      });
    } else {
      this.markFormGroupTouched();
      this.showError('Please fill in all required fields correctly.');
    }
  }

  // Forgot Password Flow
  onForgotPassword(): void {
    this.showForgotPassword = true;
    this.forgotStage = 'email';
    this.forgotErrorMessage = '';
    this.forgotSuccessMessage = '';
    this.secretQuestionText = '';
    this.tempUserEmail = '';
    this.tempResetToken = '';
    this.initForgotForm();
  }

  submitForgotEmail(): void {
    if (this.forgotForm.valid) {
      this.isLoading = true;
      const email = this.forgotForm.value.email.trim().toLowerCase();

      this.authService.forgotPassword(email).subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response.success) {
            this.tempUserEmail = email;
            this.secretQuestionText = 'What is your favorite book?'; // This should come from API
            this.forgotStage = 'answer';
            this.forgotErrorMessage = '';
            this.initForgotForm();
          } else {
            this.forgotErrorMessage = response.message || 'Email not found.';
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.forgotErrorMessage = error.error?.message || 'Failed to process request. Please try again.';
        }
      });
    } else {
      this.forgotErrorMessage = 'Please enter a valid email.';
    }
  }

  submitForgotAnswer(): void {
    if (this.forgotForm.valid) {
      this.isLoading = true;
      const answer = this.forgotForm.value.answer.trim();

      this.authService.verifySecretAnswer(this.tempUserEmail, answer).subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response.success) {
            this.forgotStage = 'reset';
            this.forgotErrorMessage = '';
            this.initForgotForm();
          } else {
            this.forgotErrorMessage = response.message || 'Incorrect answer. Please try again.';
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.forgotErrorMessage = error.error?.message || 'Failed to verify answer. Please try again.';
        }
      });
    } else {
      this.forgotErrorMessage = 'Please enter the answer.';
    }
  }

  submitResetPassword(): void {
    if (this.forgotForm.valid) {
      this.isLoading = true;
      const newPassword = this.forgotForm.value.newPassword;

      this.authService.resetPassword(this.tempUserEmail, newPassword, this.tempResetToken).subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response.success) {
            this.forgotSuccessMessage = 'Password successfully reset. You may now log in.';
            this.forgotErrorMessage = '';
            
            setTimeout(() => {
              this.closeForgotPassword();
            }, 3000);
          } else {
            this.forgotErrorMessage = response.message || 'Failed to reset password.';
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.forgotErrorMessage = error.error?.message || 'Failed to reset password. Please try again.';
        }
      });
    } else {
      this.forgotErrorMessage = 'Please enter a valid new password.';
    }
  }

  // Helper methods remain the same
  private showError(message: string): void {
    this.errorMessage = message;
    this.successMessage = '';
    
    setTimeout(() => {
      this.errorMessage = '';
    }, 5000);
  }

  private showSuccess(message: string): void {
    this.successMessage = message;
    this.errorMessage = '';
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  getFieldError(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (field && field.errors && field.touched) {
      if (field.errors['required']) {
        return `${this.getFieldDisplayName(fieldName)} is required.`;
      }
      if (field.errors['email']) {
        return 'Please enter a valid email address.';
      }
    }
    return '';
  }

  private getFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      email: 'Email',
      password: 'Password',
      answer: 'Answer',
      newPassword: 'New Password'
    };
    return displayNames[fieldName] || fieldName;
  }

  getForgotFieldError(fieldName: string): string {
    const field = this.forgotForm.get(fieldName);
    if (field && field.errors && field.touched) {
      if (field.errors['required']) {
        return `${this.getFieldDisplayName(fieldName)} is required.`;
      }
      if (fieldName === 'email' && field.errors['email']) {
        return 'Please enter a valid email address.';
      }
      if (fieldName === 'newPassword' && field.errors['minlength']) {
        return 'Password must be at least 6 characters long.';
      }
    }
    return '';
  }

  closeForgotPassword(): void {
    this.showForgotPassword = false;
    this.forgotStage = 'email';
    this.forgotForm = this.fb.group({});
    this.forgotErrorMessage = '';
    this.forgotSuccessMessage = '';
    this.secretQuestionText = '';
    this.tempUserEmail = '';
    this.tempResetToken = '';
  }

  navigateToRegister(): void {
    this.router.navigate(['/register']);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
      control?.markAsTouched();
    });
  }

  get isFormValid(): boolean {
    return this.loginForm.valid;
  }
}
