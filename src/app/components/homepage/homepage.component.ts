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


   

  // Keep all your existing navigation methods
  // ✅ FIXED SEARCH METHOD
onSearch(): void {
  if (this.searchQuery.trim()) {
    this.router.navigate(['/view'], { 
      queryParams: { q: this.searchQuery.trim() } 
    });
  } else {
    this.router.navigate(['/view']);
  }
}

// ✅ FIXED NAVIGATION METHODS
navigateToViewBooks(): void {
  this.router.navigate(['/view']);
}

navigateToBorrowBooks(): void {
  this.router.navigate(['/borrow']);
}

navigateToBorrowedBooks(): void {
  this.router.navigate(['/borrowed-returned']);
}

navigateToDonateBooks(): void {
  this.router.navigate(['/donate']);
}

navigateToComplaints(): void {
  this.router.navigate(['/complaints']);
}

navigateToProfile(): void {
  this.router.navigate(['/profile']);
}

// ✅ FIXED BORROW BOOK METHOD
borrowBook(book: Book): void {
  if (book.isAvailable && book.availableCopies > 0) {
    this.router.navigate(['/borrow'], { 
      queryParams: { bookId: book.id } 
    });
  }
}

// ✅ FIXED VIEW BOOK DETAILS METHOD
viewBookDetails(book: Book): void {
  this.router.navigate(['/view'], { 
    queryParams: { bookId: book.id } 
  });
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
