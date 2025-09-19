import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service';
import { UserDataService } from '../../services/user-data.service';
import { FineService } from '../../services/fine.service';
import { ComplaintService } from '../../services/complaint.service';
import { AuthUser } from '../../models/auth.model';
import { UserBorrowInfo } from '../../models/user.model';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnDestroy {
  // User data
  currentUser: AuthUser | null = null;
  userBorrowInfo: UserBorrowInfo | null = null;
  
  // UI states
  showProfileDropdown = false;
  showMobileMenu = false;
  showNotifications = false;
  isLoading = false;
  
  // Current route tracking
  currentRoute = '';
  
  // Notifications and alerts
  notifications: Notification[] = [];
  unreadNotificationsCount = 0;
  
  // User stats for quick display
  overdueBooks = 0;
  totalFines = 0;
  borrowedBooksCount = 0;
  
  // Search functionality
  searchQuery = '';
  showSearchSuggestions = false;
  searchSuggestions: SearchSuggestion[] = [];
  
  private subscriptions = new Subscription();

  constructor(
    private authService: AuthService,
    private userDataService: UserDataService,
    private fineService: FineService,
    private complaintService: ComplaintService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.setupUserSubscription();
    this.setupRouteTracking();
    this.setupNotifications();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // Close dropdowns when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const navbarElement = document.querySelector('.navbar');
    
    if (navbarElement && !navbarElement.contains(target)) {
      this.closeAllDropdowns();
    }
  }

  // Close dropdowns on escape key
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(): void {
    this.closeAllDropdowns();
  }

  private setupUserSubscription(): void {
    // Subscribe to user data changes
    this.subscriptions.add(
      this.userDataService.userData$.subscribe(userData => {
        this.currentUser = userData.user;
        this.userBorrowInfo = userData.borrowInfo;
        this.isLoading = userData.isLoading;
        
        // Update quick stats
        this.updateQuickStats();
        
        // Load notifications if user is logged in
        if (userData.user && userData.borrowInfo) {
          this.loadUserNotifications();
        }
        
        console.log('🔄 Navbar updated with new user data:', userData.user?.memberName);
      })
    );
  }

  private setupRouteTracking(): void {
    this.subscriptions.add(
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe((event: NavigationEnd) => {
        this.currentRoute = event.url;
        this.closeAllDropdowns();
      })
    );
  }

  private setupNotifications(): void {
    // Load notifications on component init
    if (this.currentUser) {
      this.loadUserNotifications();
    }
    
    // Set up periodic notification refresh (every 5 minutes)
    setInterval(() => {
      if (this.currentUser) {
        this.loadUserNotifications();
      }
    }, 5 * 60 * 1000);
  }

  private updateQuickStats(): void {
    if (this.userBorrowInfo) {
      this.overdueBooks = this.userBorrowInfo.overdueBooks;
      this.totalFines = this.userBorrowInfo.fines;
      this.borrowedBooksCount = this.userBorrowInfo.currentBorrowedCount;
    }
  }

  private loadUserNotifications(): void {
    if (!this.currentUser) return;

    this.notifications = [];
    
    // Add overdue book notifications
    if (this.overdueBooks > 0) {
      this.notifications.push({
        id: 'overdue-books',
        type: 'warning',
        title: 'Overdue Books',
        message: `You have ${this.overdueBooks} overdue book${this.overdueBooks > 1 ? 's' : ''}`,
        timestamp: new Date(),
        actionUrl: '/my-books',
        actionText: 'View Books'
      });
    }

    // Add fine notifications
    if (this.totalFines > 0) {
      this.notifications.push({
        id: 'pending-fines',
        type: 'error',
        title: 'Pending Fines',
        message: `You have ₹${this.totalFines} in pending fines`,
        timestamp: new Date(),
        actionUrl: '/fines',
        actionText: 'Pay Fines'
      });
    }

    // Add borrowing limit notification
    if (this.userBorrowInfo && this.userBorrowInfo.currentBorrowedCount >= this.userBorrowInfo.maxBooksAllowed) {
      this.notifications.push({
        id: 'borrowing-limit',
        type: 'info',
        title: 'Borrowing Limit Reached',
        message: 'You have reached your maximum borrowing limit',
        timestamp: new Date(),
        actionUrl: '/my-books',
        actionText: 'View Books'
      });
    }

    // Load complaint notifications
    this.loadComplaintNotifications();

    // Update unread count
    this.unreadNotificationsCount = this.notifications.length;
  }

  private loadComplaintNotifications(): void {
    if (!this.currentUser) return;

    // Get complaint statistics to check for updates
    this.subscriptions.add(
      this.complaintService.getComplaintStatistics().subscribe({
        next: (stats) => {
          if (stats.inProgressComplaints > 0) {
            this.notifications.push({
              id: 'complaint-updates',
              type: 'info',
              title: 'Complaint Updates',
              message: `You have ${stats.inProgressComplaints} complaint${stats.inProgressComplaints > 1 ? 's' : ''} in progress`,
              timestamp: new Date(),
              actionUrl: '/complaints',
              actionText: 'View Complaints'
            });
          }
        },
        error: (error) => {
          console.error('Error loading complaint notifications:', error);
        }
      })
    );
  }

  // Navigation methods
   

  onSearchInputChange(): void {
    if (this.searchQuery.length > 2) {
      this.loadSearchSuggestions();
      this.showSearchSuggestions = true;
    } else {
      this.showSearchSuggestions = false;
    }
  }

  onSearchSubmit(): void {
  if (this.searchQuery.trim()) {
    this.router.navigate(['/books'], { 
      queryParams: { search: this.searchQuery.trim() } 
    });
    this.searchQuery = '';
    this.showSearchSuggestions = false;
  }
}


  private loadSearchSuggestions(): void {
  this.searchSuggestions = [
    { type: 'book' as const, title: 'Angular Complete Guide', subtitle: 'by John Smith' },
    { type: 'author' as const, title: 'John Smith', subtitle: '15 books available' },
    { type: 'category' as const, title: 'Programming', subtitle: '120 books available' }
  ].filter(suggestion => 
    suggestion.title.toLowerCase().includes(this.searchQuery.toLowerCase())
  );
}


  selectSearchSuggestion(suggestion: SearchSuggestion): void {
    if (suggestion.type === 'book') {
      this.router.navigate(['/books'], { 
        queryParams: { search: suggestion.title } 
      });
    } else if (suggestion.type === 'author') {
      this.router.navigate(['/books'], { 
        queryParams: { author: suggestion.title } 
      });
    } else if (suggestion.type === 'category') {
      this.router.navigate(['/books'], { 
        queryParams: { category: suggestion.title } 
      });
    }
    
    this.searchQuery = '';
    this.showSearchSuggestions = false;
  }

  // Dropdown and menu methods
  toggleProfileDropdown(): void {
    this.showProfileDropdown = !this.showProfileDropdown;
    if (this.showProfileDropdown) {
      this.showNotifications = false;
      this.showMobileMenu = false;
    }
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.showProfileDropdown = false;
      this.showMobileMenu = false;
      // Mark notifications as read
      this.markNotificationsAsRead();
    }
  }

  toggleMobileMenu(): void {
    this.showMobileMenu = !this.showMobileMenu;
    if (this.showMobileMenu) {
      this.showProfileDropdown = false;
      this.showNotifications = false;
    }
  }

  closeAllDropdowns(): void {
    this.showProfileDropdown = false;
    this.showNotifications = false;
    this.showMobileMenu = false;
    this.showSearchSuggestions = false;
  }

  // Notification methods
  markNotificationsAsRead(): void {
    this.unreadNotificationsCount = 0;
  }

  dismissNotification(notificationId: string): void {
    this.notifications = this.notifications.filter(n => n.id !== notificationId);
    this.unreadNotificationsCount = Math.max(0, this.unreadNotificationsCount - 1);
  }

  handleNotificationAction(notification: Notification): void {
    if (notification.actionUrl) {
      this.router.navigate([notification.actionUrl]);
      this.closeAllDropdowns();
    }
  }

  // Navigation methods
  navigateToProfile(): void {
    this.closeAllDropdowns();
    this.router.navigate(['/profile']);
  }

  navigateToMyBooks(): void {
    this.closeAllDropdowns();
    this.router.navigate(['/my-books']);
  }

  navigateToBorrowBooks(): void {
    this.closeAllDropdowns();
    this.router.navigate(['/books']);
  }

  navigateToFines(): void {
    this.closeAllDropdowns();
    this.router.navigate(['/fines']);
  }

  navigateToComplaints(): void {
    this.closeAllDropdowns();
    this.router.navigate(['/complaints']);
  }

  navigateToDonateBooks(): void {
    this.closeAllDropdowns();
    this.router.navigate(['/donate-books']);
  }

  navigateToHome(): void {
    this.closeAllDropdowns();
    this.router.navigate(['/dashboard']);
  }

  // Authentication methods
  logout(): void {
    this.closeAllDropdowns();
    this.authService.logout();
  }

  refreshUserData(): void {
    this.userDataService.refreshUserData();
  }

  // Utility methods
  isCurrentRoute(route: string): boolean {
    return this.currentRoute === route || this.currentRoute.startsWith(route + '/');
  }

  getUserInitials(): string {
    if (!this.currentUser?.memberName) return 'U';
    
    return this.currentUser.memberName
      .split(' ')
      .map(name => name.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      case 'success': return '✅';
      default: return '📢';
    }
  }

  getNotificationClass(type: string): string {
    switch (type) {
      case 'error': return 'notification-error';
      case 'warning': return 'notification-warning';
      case 'info': return 'notification-info';
      case 'success': return 'notification-success';
      default: return 'notification-default';
    }
  }

  formatTime(timestamp: Date): string {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  }

  // Quick actions
  quickPayFines(): void {
    if (this.totalFines > 0) {
      this.navigateToFines();
    }
  }

  quickViewOverdueBooks(): void {
    if (this.overdueBooks > 0) {
      this.router.navigate(['/my-books'], { 
        queryParams: { status: 'overdue' } 
      });
    }
  }

  // Emergency logout (for security)
  // emergencyLogout(): void {
  //   this.authService.emergencyLogout();
  //   this.closeAllDropdowns();
  // }

  // Theme toggle (if implementing dark/light theme)
  toggleTheme(): void {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  }

  // Keyboard shortcuts
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'k':
          event.preventDefault();
          const searchInput = document.getElementById('searchInput') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
          }
          break;
        case '/':
          event.preventDefault();
          this.navigateToBorrowBooks();
          break;
      }
    }
  }
}

// Interfaces for type safety
interface Notification {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  actionUrl?: string;
  actionText?: string;
  isRead?: boolean;
}

interface SearchSuggestion {
  type: 'book' | 'author' | 'category';
  title: string;
  subtitle: string;
}
