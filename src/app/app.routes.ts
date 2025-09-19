import { Routes } from '@angular/router';
import { authGuard } from './Guards/auth.guard';
import { guestGuard } from './Guards/guest.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./components/member-registration/member-registration.component').then(m => m.MemberRegistrationComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'homepage',
    loadComponent: () => import('./components/homepage/homepage.component').then(m => m.HomepageComponent),
    canActivate: [authGuard]
  },
  {
    path: 'books',
    loadComponent: () => import('./components/books/books.component').then(m => m.BooksComponent),
    canActivate: [authGuard]
  },
  {
    path: 'my-books',
    loadComponent: () => import('./components/my-books/my-books.component').then(m => m.MyBooksComponent),
    canActivate: [authGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./components/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [authGuard]
  },
  {
    path: 'complaints',
    loadComponent: () => import('./components/complaints/complaints.component').then(m => m.ComplaintsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'donate-books',
    loadComponent: () => import('./components/donate-books/donate-books.component').then(m => m.DonateBooksComponent),
    canActivate: [authGuard]
  },
  {
    path: 'fines',
    loadComponent: () => import('./components/fines/fines.component').then(m => m.FinesComponent),
    canActivate: [authGuard]
  },
  {
    path: '',
    redirectTo: '/homepage',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/homepage'
  }
];
