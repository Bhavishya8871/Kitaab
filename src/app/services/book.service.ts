import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {
  Book,
  BookFormData,
  SearchCriteria,
  SearchResult,
  BookCategory,
  BorrowRequest,
  BorrowResponse,
  BookBorrower
} from '../models/book.model';

@Injectable({
  providedIn: 'root'
})
export class BookService {
  private readonly API_URL = 'http://localhost:8080/api/books';
  
  // BehaviorSubject for real-time updates
  private booksSubject = new BehaviorSubject<Book[]>([]);
  public books$ = this.booksSubject.asObservable();

  constructor(private http: HttpClient) {
    // Load initial books when service starts
    this.loadBooks();
  }

  // Load all books and update BehaviorSubject
  private loadBooks(): void {
    this.getBooks().subscribe({
      next: (response) => {
        this.booksSubject.next(response.content || response);
      },
      error: (error) => {
        console.error('Error loading books:', error);
        this.booksSubject.next([]);
      }
    });
  }

  // Get books with pagination and search
  getBooks(page: number = 0, size: number = 10, search?: string): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<any>(`${this.API_URL}`, { params })
      .pipe(
        tap(response => {
          // Update BehaviorSubject with new data
          if (page === 0) { // Only update for first page or new search
            this.booksSubject.next(response.content || response.books || []);
          }
        }),
        catchError(error => {
          console.error('Get books error:', error);
          return throwError(() => error);
        })
      );
  }

  // Get book by ID
  getBookById(id: string): Observable<Book> {
    return this.http.get<Book>(`${this.API_URL}/${id}`)
      .pipe(
        catchError(error => {
          console.error('Get book by ID error:', error);
          return throwError(() => error);
        })
      );
  }

  // Add new book with image upload
  addBook(bookData: BookFormData): Observable<Book> {
    const formData = new FormData();
    formData.append('title', bookData.title);
    formData.append('author', bookData.author);
    formData.append('category', bookData.category);
    formData.append('isbn', bookData.isbn);
    formData.append('description', bookData.description || '');
    formData.append('totalCopies', bookData.totalCopies.toString());
    formData.append('publishYear', (bookData.publishYear || new Date().getFullYear()).toString());
    
    if (bookData.imageFile) {
      formData.append('image', bookData.imageFile);
    }

    return this.http.post<Book>(`${this.API_URL}`, formData)
      .pipe(
        tap(newBook => {
          // Add to current books and update BehaviorSubject
          const currentBooks = this.booksSubject.value;
          this.booksSubject.next([...currentBooks, newBook]);
        }),
        catchError(error => {
          console.error('Add book error:', error);
          return throwError(() => error);
        })
      );
  }

  // Update existing book
  updateBook(id: string, bookData: BookFormData): Observable<Book> {
    const formData = new FormData();
    formData.append('title', bookData.title);
    formData.append('author', bookData.author);
    formData.append('category', bookData.category);
    formData.append('isbn', bookData.isbn);
    formData.append('description', bookData.description || '');
    formData.append('totalCopies', bookData.totalCopies.toString());
    formData.append('publishYear', (bookData.publishYear || new Date().getFullYear()).toString());
    
    if (bookData.imageFile) {
      formData.append('image', bookData.imageFile);
    }

    return this.http.put<Book>(`${this.API_URL}/${id}`, formData)
      .pipe(
        tap(updatedBook => {
          // Update in current books and update BehaviorSubject
          const currentBooks = this.booksSubject.value;
          const index = currentBooks.findIndex(book => book.id === id);
          if (index !== -1) {
            currentBooks[index] = updatedBook;
            this.booksSubject.next([...currentBooks]);
          }
        }),
        catchError(error => {
          console.error('Update book error:', error);
          return throwError(() => error);
        })
      );
  }

  // Delete book
  deleteBook(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`)
      .pipe(
        tap(() => {
          // Remove from current books and update BehaviorSubject
          const currentBooks = this.booksSubject.value;
          const filteredBooks = currentBooks.filter(book => book.id !== id);
          this.booksSubject.next(filteredBooks);
        }),
        catchError(error => {
          console.error('Delete book error:', error);
          return throwError(() => error);
        })
      );
  }

  // Search books with advanced criteria
  searchBooks(criteria: SearchCriteria): Observable<SearchResult> {
    let params = new HttpParams();
    
    if (criteria.title) params = params.set('title', criteria.title);
    if (criteria.author) params = params.set('author', criteria.author);
    if (criteria.category) params = params.set('category', criteria.category);
    if (criteria.bookId) params = params.set('bookId', criteria.bookId);
    
    return this.http.get<SearchResult>(`${this.API_URL}/search`, { params })
      .pipe(
        catchError(error => {
          console.error('Search books error:', error);
          return throwError(() => error);
        })
      );
  }

  // Advanced search with multiple parameters
  searchBooksAdvanced(query?: string, category?: string, availability?: string, page: number = 0, size: number = 10): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    if (query) params = params.set('query', query);
    if (category && category !== 'all') params = params.set('category', category);
    if (availability && availability !== 'all') params = params.set('availability', availability);

    return this.http.get<any>(`${this.API_URL}/search/advanced`, { params })
      .pipe(
        catchError(error => {
          console.error('Advanced search error:', error);
          return throwError(() => error);
        })
      );
  }

  // Get book categories
  getBookCategories(): Observable<BookCategory[]> {
    return this.http.get<BookCategory[]>(`${this.API_URL}/categories`)
      .pipe(
        catchError(error => {
          console.error('Get categories error:', error);
          return throwError(() => error);
        })
      );
  }

  // Get available books only
  getAvailableBooks(page: number = 0, size: number = 10): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('availability', 'available');

    return this.http.get<any>(`${this.API_URL}`, { params })
      .pipe(
        catchError(error => {
          console.error('Get available books error:', error);
          return throwError(() => error);
        })
      );
  }

  // Get popular books
  getPopularBooks(): Observable<Book[]> {
    return this.http.get<Book[]>(`${this.API_URL}/popular`)
      .pipe(
        catchError(error => {
          console.error('Get popular books error:', error);
          return throwError(() => error);
        })
      );
  }

  // Get books by category
  getBooksByCategory(category: string, page: number = 0, size: number = 10): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('category', category);

    return this.http.get<any>(`${this.API_URL}`, { params })
      .pipe(
        catchError(error => {
          console.error('Get books by category error:', error);
          return throwError(() => error);
        })
      );
  }

  // Borrow books
  borrowBooks(borrowRequest: BorrowRequest): Observable<BorrowResponse> {
    return this.http.post<BorrowResponse>(`${this.API_URL}/borrow`, borrowRequest)
      .pipe(
        tap(response => {
          if (response.success) {
            // Refresh books to update availability
            this.loadBooks();
          }
        }),
        catchError(error => {
          console.error('Borrow books error:', error);
          return throwError(() => error);
        })
      );
  }

  // Return books
  returnBooks(borrowId: string, bookIds: string[]): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.API_URL}/return`, {
      borrowId,
      bookIds
    }).pipe(
      tap(response => {
        if (response.success) {
          // Refresh books to update availability
          this.loadBooks();
        }
      }),
      catchError(error => {
        console.error('Return books error:', error);
        return throwError(() => error);
      })
    );
  }

  // Get book borrowers
  getBookBorrowers(bookId: string): Observable<BookBorrower[]> {
    return this.http.get<BookBorrower[]>(`${this.API_URL}/${bookId}/borrowers`)
      .pipe(
        catchError(error => {
          console.error('Get book borrowers error:', error);
          return throwError(() => error);
        })
      );
  }

  // Update book availability (for admin)
  updateBookAvailability(bookId: string, availableCopies: number): Observable<Book> {
    return this.http.patch<Book>(`${this.API_URL}/${bookId}/availability`, { availableCopies })
      .pipe(
        tap(updatedBook => {
          // Update in current books
          const currentBooks = this.booksSubject.value;
          const index = currentBooks.findIndex(book => book.id === bookId);
          if (index !== -1) {
            currentBooks[index] = updatedBook;
            this.booksSubject.next([...currentBooks]);
          }
        }),
        catchError(error => {
          console.error('Update book availability error:', error);
          return throwError(() => error);
        })
      );
  }
  
  // Get book statistics
  getBookStatistics(): Observable<{
    totalBooks: number;
    availableBooks: number;
    borrowedBooks: number;
    categories: number;
  }> {
    return this.http.get<{
      totalBooks: number;
      availableBooks: number;
      borrowedBooks: number;
      categories: number;
    }>(`${this.API_URL}/statistics`)
      .pipe(
        catchError(error => {
          console.error('Get book statistics error:', error);
          return throwError(() => error);
        })
      );
  }

  // Refresh books data (manual refresh)
  refreshBooks(): void {
    this.loadBooks();
  }

  // Get current books from BehaviorSubject
  getCurrentBooks(): Book[] {
    return this.booksSubject.value;
  }
}
