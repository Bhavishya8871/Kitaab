import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

import { BookService } from '../../services/book.service';
import { AuthService } from '../../services/auth.service';
import { Book, SearchCriteria, SearchResult, BookCategory, BorrowRequest, BorrowItem, PaginatedResponse } from '../../models/book.model';
import { AuthUser } from '../../models/auth.model';
import { NavbarComponent } from '../navbar/navbar.component';

interface ExtendedSearchCriteria extends SearchCriteria {
  availabilityFilter?: 'all' | 'available' | 'unavailable';
  sortBy?: 'title' | 'author' | 'category' | 'rating' | 'publishYear';
  sortOrder?: 'asc' | 'desc';
}

interface AvailabilityInfo {
  status: 'Available' | 'Limited' | 'Unavailable';
  message: string;
  nextAvailableDate?: string;
}

@Component({
  selector: 'app-books',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NavbarComponent],
  templateUrl: './books.component.html',
  styleUrls: ['./books.component.css']
})
export class BooksComponent implements OnInit, OnDestroy {
  // Forms
  searchForm!: FormGroup;
  
  // Data
  books: Book[] = [];
  searchResults: SearchResult | null = null;
  categories: BookCategory[] = [];
  selectedBooks: Map<string, number> = new Map();
  
  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;
  
  // User Data
  currentUser: AuthUser | null = null;
  userBorrowInfo: any = null; // Will be fetched from backend
  
  // Modal States
  selectedBook: Book | null = null;
  showBookModal = false;
  showAvailabilityModal = false;
  showBorrowConfirmModal = false;
  availabilityInfo: AvailabilityInfo | null = null;
  
  // Component States
  isSearching = false;
  isLoadingUser = false;
  hasSearched = false;
  isBorrowing = false;
  isLoadingBooks = false;
  
  // Messages
  errorMessage = '';
  successMessage = '';
  
  // Constants
  readonly MAX_BOOKS_PER_USER = 5;
  readonly BORROW_PERIOD_DAYS = 14;
  readonly FINE_PER_DAY = 5;
  
  // Configuration
  searchTypes = [
    { value: 'all', label: 'All Fields' },
    { value: 'title', label: 'Title' },
    { value: 'author', label: 'Author' },
    { value: 'category', label: 'Category' },
    { value: 'bookId', label: 'Book ID' }
  ];

  sortOptions = [
    { value: 'title', label: 'Title' },
    { value: 'author', label: 'Author' },
    { value: 'category', label: 'Category' },
    { value: 'rating', label: 'Rating' },
    { value: 'publishYear', label: 'Publication Year' }
  ];

  private searchSubject = new Subject<void>();
  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private bookService: BookService,
    private authService: AuthService,
    public router: Router,
    private route: ActivatedRoute
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadUserData();
    this.loadBooks();
    this.loadCategories();
    this.setupSearch();
    this.handleRouteParams();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private initializeForm(): void {
    this.searchForm = this.fb.group({
      query: [''],
      searchType: ['all'],
      category: [''],
      availabilityFilter: ['all'],
      sortBy: ['title'],
      sortOrder: ['asc']
    });
  }

  // Load user data from AuthService
  private loadUserData(): void {
    this.isLoadingUser = true;
    
    this.subscriptions.add(
      this.authService.currentUser$.subscribe({
        next: (user) => {
          this.currentUser = user;
          if (user) {
            this.loadUserBorrowInfo(user.memberId);
          }
          this.isLoadingUser = false;
        },
        error: (error) => {
          console.error('Error loading user:', error);
          this.showError('Failed to load user information');
          this.isLoadingUser = false;
        }
      })
    );
  }

  // Load user borrowing information from backend
  private loadUserBorrowInfo(memberId: string): void {
    // This would typically call a user service to get borrow info
    // For now, creating mock data structure
    this.userBorrowInfo = {
      currentBorrowedCount: 2,
      fines: 0,
      overdueBooks: 0
    };
  }

  // Load books with pagination
  private loadBooks(page: number = 0, search?: string): void {
    this.isLoadingBooks = true;
    
    this.subscriptions.add(
      this.bookService.getBooks(page, this.pageSize, search).subscribe({
        next: (response: PaginatedResponse<Book>) => {
          if (page === 0) {
            this.books = response.content;
          } else {
            this.books = [...this.books, ...response.content];
          }
          
          this.totalPages = response.totalPages;
          this.totalElements = response.totalElements;
          this.currentPage = response.number;
          
          // Update search results if we have them
          if (this.hasSearched) {
            this.performSearch();
          } else {
            this.searchResults = {
              books: this.books,
              totalCount: this.totalElements,
              searchTerm: 'All Books'
            };
          }
          
          this.isLoadingBooks = false;
        },
        error: (error) => {
          console.error('Error loading books:', error);
          this.showError('Failed to load books. Please try again.');
          this.isLoadingBooks = false;
        }
      })
    );
  }

  // Load categories from backend
  private loadCategories(): void {
    this.subscriptions.add(
      this.bookService.getBookCategories().subscribe({
        next: (categories) => {
          this.categories = categories;
        },
        error: (error) => {
          console.error('Error loading categories:', error);
        }
      })
    );
  }

  private setupSearch(): void {
    // Real-time search with debouncing
    this.subscriptions.add(
      this.searchForm.valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
      ).subscribe(() => {
        this.searchSubject.next();
      })
    );

    // Search execution
    this.subscriptions.add(
      this.searchSubject.pipe(
        debounceTime(300)
      ).subscribe(() => {
        this.performSearch();
      })
    );
  }

  private handleRouteParams(): void {
    this.subscriptions.add(
      this.route.queryParams.subscribe(params => {
        if (params['q']) {
          this.searchForm.patchValue({
            query: params['q'],
            searchType: params['searchType'] || 'all'
          });
        }
      })
    );
  }

  // Perform search using backend service
  performSearch(): void {
    this.isSearching = true;
    this.currentPage = 0;
    
    const formValue = this.searchForm.value;
    const query = formValue.query?.trim();
    const category = formValue.category !== '' ? formValue.category : undefined;
    const availability = formValue.availabilityFilter;

    this.subscriptions.add(
      this.bookService.searchBooksAdvanced(query, category, availability, this.currentPage, this.pageSize).subscribe({
        next: (response: PaginatedResponse<Book>) => {
          this.searchResults = {
            books: response.content,
            totalCount: response.totalElements,
            searchTerm: this.buildSearchTerm(formValue),
            totalPages: response.totalPages,
            currentPage: response.number,
            pageSize: response.size
          };
          
          this.totalPages = response.totalPages;
          this.totalElements = response.totalElements;
          this.hasSearched = true;
          this.isSearching = false;
        },
        error: (error) => {
          console.error('Search error:', error);
          this.showError('Search failed. Please try again.');
          this.isSearching = false;
        }
      })
    );
  }

  private buildSearchTerm(formValue: any): string {
    const terms: string[] = [];
    if (formValue.query) terms.push(`"${formValue.query}"`);
    if (formValue.category) terms.push(`Category: ${formValue.category}`);
    if (formValue.availabilityFilter !== 'all') terms.push(`${formValue.availabilityFilter}`);
    return terms.join(', ') || 'All Books';
  }

  // Load more results for pagination
  loadMoreResults(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.loadBooks(this.currentPage, this.searchForm.value.query);
    }
  }

  // Borrowing logic with backend integration
  onQuantityChange(bookId: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    const quantity = parseInt(target.value, 10) || 0;
    
    if (quantity <= 0) {
      this.selectedBooks.delete(bookId);
    } else {
      const book = this.searchResults?.books.find(b => b.id === bookId);
      if (book && quantity > book.availableCopies) {
        this.showError(`Only ${book.availableCopies} copies of "${book.title}" are available.`);
        target.value = book.availableCopies.toString();
        this.selectedBooks.set(bookId, book.availableCopies);
      } else {
        this.selectedBooks.set(bookId, quantity);
      }
    }
    this.validateSelection();
  }

  private validateSelection(): void {
    if (!this.userBorrowInfo) return;
    
    const totalSelected = this.getTotalSelectedCopies();
    const totalAfterBorrow = this.userBorrowInfo.currentBorrowedCount + totalSelected;
    
    if (totalAfterBorrow > this.MAX_BOOKS_PER_USER) {
      this.showError(`You cannot borrow more than ${this.MAX_BOOKS_PER_USER} books in total.`);
    } else if (this.userBorrowInfo.fines > 0) {
      this.showError(`You have pending fines of ₹${this.userBorrowInfo.fines}. Please clear them before borrowing.`);
    } else if (this.userBorrowInfo.overdueBooks > 0) {
      this.showError(`You have ${this.userBorrowInfo.overdueBooks} overdue book(s). Please return them first.`);
    } else {
      this.clearError();
    }
  }

  onBorrowBook(book: Book): void {
    if (!this.currentUser) {
      this.showError('Please log in to borrow books.');
      return;
    }

    if (!book.isAvailable || book.availableCopies === 0) {
      this.onCheckAvailability(book);
      return;
    }

    // Set quantity to 1 and show confirmation
    this.selectedBooks.clear();
    this.selectedBooks.set(book.id, 1);
    this.showBorrowConfirmModal = true;
  }

  onBorrowSelected(): void {
    if (this.selectedBooks.size === 0) {
      this.showError('Please select at least one book to borrow.');
      return;
    }
    this.showBorrowConfirmModal = true;
  }

  // Confirm borrow with backend API call
  confirmBorrow(): void {
    if (!this.currentUser || !this.userBorrowInfo) return;

    this.isBorrowing = true;
    
    const borrowItems: BorrowItem[] = Array.from(this.selectedBooks.entries()).map(([bookId, quantity]) => ({
      bookId,
      quantity
    }));

    const borrowRequest: BorrowRequest = {
      memberId: this.currentUser.memberId,
      borrowItems,
      borrowDate: new Date(),
      dueDate: new Date(Date.now() + this.BORROW_PERIOD_DAYS * 24 * 60 * 60 * 1000),
      notes: `Borrowed ${this.getTotalSelectedCopies()} book(s)`
    };

    this.subscriptions.add(
      this.bookService.borrowBooks(borrowRequest).subscribe({
        next: (response) => {
          if (response.success) {
            const borrowedBooksList = this.getSelectedBookDetails()
              .map(item => `${item.quantity}x ${item.book.title}`)
              .join(', ');

            this.showSuccess(
              `✅ Successfully borrowed: ${borrowedBooksList}. Due date: ${response.dueDate ? new Date(response.dueDate).toLocaleDateString() : this.calculatedDueDate}`
            );

            // Update user borrow count
            this.userBorrowInfo.currentBorrowedCount += this.getTotalSelectedCopies();
            
            // Clear selections and close modal
            this.selectedBooks.clear();
            this.showBorrowConfirmModal = false;
            
            // Refresh search results to show updated availability
            this.performSearch();
          } else {
            this.showError(response.message || 'Failed to borrow books. Please try again.');
          }
          this.isBorrowing = false;
        },
        error: (error) => {
          console.error('Borrow error:', error);
          let errorMessage = 'Failed to borrow books. Please try again.';
          
          if (error.status === 400) {
            errorMessage = error.error?.message || 'Invalid borrow request.';
          } else if (error.status === 409) {
            errorMessage = 'Some books are no longer available.';
          }
          
          this.showError(errorMessage);
          this.isBorrowing = false;
        }
      })
    );
  }

  // Modal and utility methods
  onBookClick(book: Book): void {
    // Fetch complete book details from backend
    this.subscriptions.add(
      this.bookService.getBookById(book.id).subscribe({
        next: (bookDetails) => {
          this.selectedBook = bookDetails;
          this.showBookModal = true;
        },
        error: (error) => {
          console.error('Error loading book details:', error);
          this.selectedBook = book; // Fallback to current data
          this.showBookModal = true;
        }
      })
    );
  }

  onCheckAvailability(book: Book): void {
    // Get real availability info from backend
    this.subscriptions.add(
      this.bookService.getBookBorrowers(book.id).subscribe({
        next: (borrowers) => {
          this.availabilityInfo = this.calculateAvailabilityInfo(book, borrowers);
          this.showAvailabilityModal = true;
        },
        error: (error) => {
          console.error('Error checking availability:', error);
          this.availabilityInfo = this.getAvailabilityInfo(book);
          this.showAvailabilityModal = true;
        }
      })
    );
  }

  private calculateAvailabilityInfo(book: Book, borrowers: any[]): AvailabilityInfo {
    if (!book.isAvailable || book.availableCopies === 0) {
      const earliestReturn = borrowers
        .filter(b => !b.returnDate)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

      return {
        status: 'Unavailable',
        message: `All ${book.totalCopies} copies are currently borrowed.`,
        nextAvailableDate: earliestReturn?.dueDate
      };
    } else if (book.availableCopies === 1) {
      return {
        status: 'Limited',
        message: `Only 1 copy remaining out of ${book.totalCopies} total copies.`
      };
    } else {
      return {
        status: 'Available',
        message: `${book.availableCopies} of ${book.totalCopies} copies available.`
      };
    }
  }

  private getAvailabilityInfo(book: Book): AvailabilityInfo {
    // Fallback method for offline calculation
    if (!book.isAvailable || book.availableCopies === 0) {
      return {
        status: 'Unavailable',
        message: `This book is currently not available.`
      };
    } else if (book.availableCopies === 1) {
      return {
        status: 'Limited',
        message: `Only 1 copy remaining out of ${book.totalCopies} total copies.`
      };
    } else {
      return {
        status: 'Available',
        message: `${book.availableCopies} of ${book.totalCopies} copies available.`
      };
    }
  }

  closeModal(): void {
    this.showBookModal = false;
    this.showAvailabilityModal = false;
    this.showBorrowConfirmModal = false;
    this.selectedBook = null;
    this.availabilityInfo = null;
  }

  clearSearch(): void {
    this.searchForm.reset({
      query: '',
      searchType: 'all',
      category: '',
      availabilityFilter: 'all',
      sortBy: 'title',
      sortOrder: 'asc'
    });
    this.hasSearched = false;
    this.loadBooks(0); // Reload all books
  }

  // Helper methods
  getTotalSelectedCopies(): number {
    return Array.from(this.selectedBooks.values()).reduce((sum, quantity) => sum + quantity, 0);
  }

  getSelectedBookDetails(): Array<{book: Book, quantity: number}> {
    return Array.from(this.selectedBooks.entries()).map(([bookId, quantity]) => {
      const book = this.searchResults?.books.find(b => b.id === bookId) || 
                   this.books.find(b => b.id === bookId);
      return { book: book!, quantity };
    });
  }

  get calculatedDueDate(): string {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + this.BORROW_PERIOD_DAYS);
    return dueDate.toLocaleDateString();
  }

  getAvailabilityClass(book: Book): string {
    if (!book.isAvailable || book.availableCopies === 0) {
      return 'availability-unavailable';
    } else if (book.availableCopies === 1) {
      return 'availability-limited';
    } else {
      return 'availability-available';
    }
  }

  getAvailabilityText(book: Book): string {
    if (!book.isAvailable || book.availableCopies === 0) {
      return 'Unavailable';
    } else if (book.availableCopies === 1) {
      return 'Limited';
    } else {
      return 'Available';
    }
  }

  private showError(message: string): void {
    this.errorMessage = message;
    this.successMessage = '';
    setTimeout(() => this.clearError(), 5000);
  }

  private showSuccess(message: string): void {
    this.successMessage = message;
    this.errorMessage = '';
    setTimeout(() => this.clearSuccess(), 8000);
  }

  private clearError(): void {
    this.errorMessage = '';
  }

  private clearSuccess(): void {
    this.successMessage = '';
  }

  navigateToMyBooks(): void {
    this.router.navigate(['/my-books']);
  }

  trackByBookId(index: number, book: Book): string {
    return book.id;
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=400&fit=crop';
    }
  }
}
