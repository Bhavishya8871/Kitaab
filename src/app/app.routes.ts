import { Routes } from '@angular/router';
import { MemberRegistrationComponent } from './components/member-registration/member-registration.component';
import { LoginComponent } from './components/login/login.component';
import { HomepageComponent } from './components/homepage/homepage.component';
import { DonateBooksComponent } from './components/donate-books/donate-books.component';
import { ComplaintsComponent } from './components/complaints/complaints.component';
import { ProfileComponent } from './components/profile/profile.component';
import { MyBooksComponent } from './components/my-books/my-books.component';
import { BooksComponent } from './components/books/books.component';
import { FinesComponent } from './components/fines/fines.component';

// ✅ Import your guards
import { authGuard } from './Guards/auth.guard';
import { guestGuard } from './Guards/guest.guard';

export const routes: Routes = [
  { 
    path: '', 
    redirectTo: '/login', 
    pathMatch: 'full' 
  },
  { 
    path: 'login', 
    component: LoginComponent,
    canActivate: [guestGuard] // ✅ Only allow if NOT logged in
  },
  { 
    path: 'register', 
    component: MemberRegistrationComponent,
    canActivate: [guestGuard] // ✅ Only allow if NOT logged in
  },
  { 
    path: 'homepage', 
    component: HomepageComponent,
    canActivate: [authGuard] // ✅ Only allow if logged in
  },
  { 
    path: 'borrow', 
    component: BooksComponent,
    canActivate: [authGuard] // ✅ Only allow if logged in
  }, 
  { 
    path: 'view', 
    component: BooksComponent,
    canActivate: [authGuard] // ✅ Only allow if logged in
  }, 
  { 
    path: 'donate', 
    component: DonateBooksComponent,
    canActivate: [authGuard] // ✅ Only allow if logged in
  },
  { 
    path: 'complaints', 
    component: ComplaintsComponent,
    canActivate: [authGuard] // ✅ Only allow if logged in
  },
  { 
    path: 'profile', 
    component: ProfileComponent,
    canActivate: [authGuard] // ✅ Only allow if logged in
  },
  { 
    path: 'borrowed-returned', 
    component: MyBooksComponent,
    canActivate: [authGuard] // ✅ Only allow if logged in
  },
  { 
    path: 'fines', 
    component: FinesComponent,
    canActivate: [authGuard] // ✅ Only allow if logged in
  },
  { 
    path: 'payments', 
    redirectTo: '/fines', 
    pathMatch: 'full' 
  },
  {
    path: '**',
    redirectTo: '/login' // ✅ Redirect unknown routes to login
  }
];
