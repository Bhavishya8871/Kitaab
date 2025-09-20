import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { AuthUser } from '../../models/auth.model';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnDestroy {
  currentUser: AuthUser | null = null;
  showProfileDropdown = false;
  showMobileMenu = false;
  private userSubscription: Subscription = new Subscription();

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // ✅ Subscribe to real-time user updates
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      console.log('🔄 Navbar updated with new user data:', user?.memberName); // Debug log
    });

    

  }

  ngOnDestroy(): void {
    this.userSubscription.unsubscribe();
  }

  // Rest of your methods remain the same...
  onSearchClick(): void {
    this.router.navigate(['/view']);
  }

  toggleProfileDropdown(): void {
    this.showProfileDropdown = !this.showProfileDropdown;
  }

  toggleMobileMenu(): void {
    this.showMobileMenu = !this.showMobileMenu;
  }

  navigateToProfile(): void {
    this.showProfileDropdown = false;
    this.router.navigate(['/profile']);
  }

  navigateToBorrowedBooks(): void {
    this.showProfileDropdown = false;
    this.router.navigate(['/borrowed-returned']);
  }

  logout(): void {
    this.showProfileDropdown = false;
    this.authService.logout();
  }

  closeDropdowns(): void {
    this.showProfileDropdown = false;
    this.showMobileMenu = false;
  }
}
