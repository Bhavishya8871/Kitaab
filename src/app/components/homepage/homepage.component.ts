import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { BookService } from '../../services/book.service';
import { AuthUser } from '../../models/auth.model';
 
import { NavbarComponent } from "../navbar/navbar.component";
import { Book, PaginatedResponse } from '../../models/book.model';


@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NavbarComponent],
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.css']
})
export class HomepageComponent implements OnInit, OnDestroy {
  currentUser: AuthUser | null = null;
  popularBooks: Book[] = [];
  searchQuery: string = '';
  isLoading = true;
  
  private subscriptions = new Subscription();

  constructor(
    private authService: AuthService,
    private bookService: BookService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        if (!user) {
          this.router.navigate(['/login']);
        }
      })
    );

    this.loadPopularBooks();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadPopularBooks(): void {
  this.isLoading = true;
  
  this.subscriptions.add(
    this.bookService.getBooks(0, 20).subscribe({
      next: (response: PaginatedResponse<Book>) => {
        // Filter for books with rating > 4.0 (popular)
        this.popularBooks = response.content
          .filter((book: Book) => book.rating && book.rating > 4.0)
          .slice(0, 8);
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading popular books:', error);
        this.isLoading = false;
        this.popularBooks = [];
      }
    })
  );
}


  onSearch(): void {
    if (this.searchQuery.trim()) {
      this.router.navigate(['/books'], { 
        queryParams: { q: this.searchQuery.trim() } 
      });
    } else {
      this.router.navigate(['/books']);
    }
  }

  // Keep all your existing navigation methods
  navigateToViewBooks(): void {
    this.router.navigate(['/books']);
  }

  navigateToBorrowBooks(): void {
    this.router.navigate(['/books']);
  }

  navigateToBorrowedBooks(): void {
    this.router.navigate(['/my-books']);
  }

  navigateToDonateBooks(): void {
    this.router.navigate(['/donate-books']);
  }

  navigateToComplaints(): void {
    this.router.navigate(['/complaints']);
  }

  navigateToProfile(): void {
    this.router.navigate(['/profile']);
  }

  borrowBook(book: Book): void {
    if (book.isAvailable && book.availableCopies > 0) {
      this.router.navigate(['/books'], { queryParams: { bookId: book.id } });
    }
  }

  viewBookDetails(book: Book): void {
    this.router.navigate(['/books', book.id]);
  }

  // Keep your existing utility methods
  getStarArray(rating: number): number[] {
    return Array(Math.floor(rating)).fill(0);
  }

  getEmptyStarArray(rating: number): number[] {
    return Array(5 - Math.floor(rating)).fill(0);
  }

  hasHalfStar(rating: number): boolean {
    return rating % 1 !== 0;
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=400&fit=crop';
    }
  }

  logout(): void {
    this.authService.logout();
  }

  closeDropdowns(): void {
    // Keep empty for now
  }
}
