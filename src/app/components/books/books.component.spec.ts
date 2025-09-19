import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { BooksComponent } from './books.component';
import { BookService } from '../../services/book.service';
import { AuthService } from '../../services/auth.service';
import { UserDataService } from '../../services/user-data.service';
import { of } from 'rxjs';

describe('BooksComponent', () => {
  let component: BooksComponent;
  let fixture: ComponentFixture<BooksComponent>;
  let bookServiceSpy: jasmine.SpyObj<BookService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let userDataServiceSpy: jasmine.SpyObj<UserDataService>;

  beforeEach(async () => {
    const bookSpy = jasmine.createSpyObj('BookService', ['getAllBooks', 'getBookCategories']);
    const authSpy = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    const userDataSpy = jasmine.createSpyObj('UserDataService', ['refreshUserData'], {
      userData$: of({
        user: {
          memberId: 'TEST001',
          memberName: 'Test User',
          email: 'test@example.com',
          token: 'test-token',
          loginTime: new Date()
        },
        borrowInfo: {
          libraryId: 'TEST001',
          name: 'Test User',
          email: 'test@example.com',
          currentBorrowedCount: 2,
          maxBooksAllowed: 5,
          fines: 0,
          overdueBooks: 0,
          isEligible: true
        },
        isLoading: false,
        error: null
      })
    });

    await TestBed.configureTestingModule({
      imports: [BooksComponent, ReactiveFormsModule, RouterTestingModule],
      providers: [
        { provide: BookService, useValue: bookSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: UserDataService, useValue: userDataSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BooksComponent);
    component = fixture.componentInstance;
    bookServiceSpy = TestBed.inject(BookService) as jasmine.SpyObj<BookService>;
    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    userDataServiceSpy = TestBed.inject(UserDataService) as jasmine.SpyObj<UserDataService>;

    // Setup mock returns
    bookServiceSpy.getAllBooks.and.returnValue(of([]));
    bookServiceSpy.getBookCategories.and.returnValue(of([]));

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize search form', () => {
    expect(component.searchForm).toBeDefined();
    expect(component.searchForm.get('query')).toBeTruthy();
    expect(component.searchForm.get('searchType')).toBeTruthy();
  });

  it('should load user data on init', () => {
    expect(component.currentUser).toBeTruthy();
    expect(component.userBorrowInfo).toBeTruthy();
  });
});
