import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component'; // ✅ Add this import
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, NavbarComponent], // ✅ Add NavbarComponent here
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'library-management-system';
  showNavBar = false; // ✅ Change from true to false
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Listen to route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event: NavigationEnd) => {
      this.updateNavBarVisibility(event.urlAfterRedirects);
    });

    // Also listen to auth state changes
    this.authService.currentUser$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(user => {
      this.updateNavBarVisibility(this.router.url);
    });
    
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ✅ Replace your existing method with this:
  private updateNavBarVisibility(url: string): void {
    const isLoggedIn = this.authService.isLoggedIn();
    
    // Pages where navbar should be hidden
    const hideNavbarPages = ['/login', '/register'];
    const shouldHideNavbar = hideNavbarPages.some(page => url.startsWith(page));
    
    // Public pages where navbar should show even without login
    const publicPages = ['/books', '/homepage']; // Add pages you want public
    const isPublicPage = publicPages.some(page => url.startsWith(page));
    
    // Show navbar when:
    // 1. Not on hide-navbar pages AND
    // 2. (User is logged in OR it's a public page)
    this.showNavBar = !shouldHideNavbar && (isLoggedIn || isPublicPage);
    
    console.log(`URL: ${url}, Logged in: ${isLoggedIn}, Should hide: ${shouldHideNavbar}, Show navbar: ${this.showNavBar}`);
  }
}
