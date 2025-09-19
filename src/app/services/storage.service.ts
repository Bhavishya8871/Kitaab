import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

export interface StorageEvent {
  key: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private isBrowser: boolean;
  private storageEvents = new BehaviorSubject<StorageEvent | null>(null);
  public storageEvents$ = this.storageEvents.asObservable();

  // Cache for frequently accessed items
  private cache = new Map<string, { value: any; timestamp: number; ttl: number }>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    
    if (this.isBrowser) {
      this.setupStorageListener();
    }
  }

  private setupStorageListener(): void {
    if (this.isBrowser) {
      window.addEventListener('storage', (event) => {
        if (event.key && event.storageArea === localStorage) {
          const storageEvent: StorageEvent = {
            key: event.key,
            oldValue: event.oldValue ? this.safeParseJSON(event.oldValue) : null,
            newValue: event.newValue ? this.safeParseJSON(event.newValue) : null,
            timestamp: new Date()
          };
          this.storageEvents.next(storageEvent);
        }
      });
    }
  }

  // Basic storage operations
  setItem(key: string, value: string, ttl?: number): void {
    if (!this.isBrowser || typeof Storage === 'undefined') {
      return;
    }

    try {
      const oldValue = localStorage.getItem(key);
      localStorage.setItem(key, value);
      
      // Update cache
      this.cache.set(key, {
        value,
        timestamp: Date.now(),
        ttl: ttl || this.DEFAULT_TTL
      });

      // Emit storage event
      this.storageEvents.next({
        key,
        oldValue: oldValue ? this.safeParseJSON(oldValue) : null,
        newValue: this.safeParseJSON(value),
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error setting localStorage item:', error);
    }
  }

  getItem(key: string, useCache: boolean = true): string | null {
    if (!this.isBrowser || typeof Storage === 'undefined') {
      return null;
    }

    try {
      // Check cache first
      if (useCache && this.cache.has(key)) {
        const cached = this.cache.get(key)!;
        if (Date.now() - cached.timestamp < cached.ttl) {
          return cached.value;
        } else {
          this.cache.delete(key);
        }
      }

      const value = localStorage.getItem(key);
      
      // Update cache
      if (value && useCache) {
        this.cache.set(key, {
          value,
          timestamp: Date.now(),
          ttl: this.DEFAULT_TTL
        });
      }

      return value;
    } catch (error) {
      console.error('Error getting localStorage item:', error);
      return null;
    }
  }

  removeItem(key: string): void {
    if (!this.isBrowser || typeof Storage === 'undefined') {
      return;
    }

    try {
      const oldValue = localStorage.getItem(key);
      localStorage.removeItem(key);
      this.cache.delete(key);

      // Emit storage event
      this.storageEvents.next({
        key,
        oldValue: oldValue ? this.safeParseJSON(oldValue) : null,
        newValue: null,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error removing localStorage item:', error);
    }
  }

  clear(): void {
    if (!this.isBrowser || typeof Storage === 'undefined') {
      return;
    }

    try {
      localStorage.clear();
      this.cache.clear();
      
      // Emit clear event
      this.storageEvents.next({
        key: '*',
        oldValue: null,
        newValue: null,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }

  // Enhanced methods for objects
  setObject<T>(key: string, value: T, ttl?: number): void {
    try {
      const jsonValue = JSON.stringify(value);
      this.setItem(key, jsonValue, ttl);
    } catch (error) {
      console.error('Error serializing object for localStorage:', error);
    }
  }

  getObject<T>(key: string, useCache: boolean = true): T | null {
    try {
      const value = this.getItem(key, useCache);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error parsing object from localStorage:', error);
      return null;
    }
  }

  // Batch operations
  setMultiple(items: { key: string; value: string; ttl?: number }[]): void {
    items.forEach(item => {
      this.setItem(item.key, item.value, item.ttl);
    });
  }

  getMultiple(keys: string[], useCache: boolean = true): { [key: string]: string | null } {
    const result: { [key: string]: string | null } = {};
    keys.forEach(key => {
      result[key] = this.getItem(key, useCache);
    });
    return result;
  }

  // Key management
  getAllKeys(): string[] {
    if (!this.isBrowser || typeof Storage === 'undefined') {
      return [];
    }

    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          keys.push(key);
        }
      }
      return keys;
    } catch (error) {
      console.error('Error getting localStorage keys:', error);
      return [];
    }
  }

  exists(key: string): boolean {
    return this.getItem(key) !== null;
  }

  // Size and capacity management
  getStorageSize(): number {
    if (!this.isBrowser || typeof Storage === 'undefined') {
      return 0;
    }

    try {
      let total = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += localStorage[key].length + key.length;
        }
      }
      return total;
    } catch (error) {
      console.error('Error calculating storage size:', error);
      return 0;
    }
  }

  getStorageSizeFormatted(): string {
    const bytes = this.getStorageSize();
    
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Cache management
  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  // Expiration management
  setWithExpiration<T>(key: string, value: T, expirationMs: number): void {
    const item = {
      value,
      expiration: Date.now() + expirationMs
    };
    this.setObject(key, item);
  }

  getWithExpiration<T>(key: string): T | null {
    const item = this.getObject<{ value: T; expiration: number }>(key);
    
    if (!item) {
      return null;
    }

    if (Date.now() > item.expiration) {
      this.removeItem(key);
      return null;
    }

    return item.value;
  }

  // Migration and backup
  exportData(): string {
    if (!this.isBrowser || typeof Storage === 'undefined') {
      return '{}';
    }

    try {
      const data: { [key: string]: string } = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          data[key] = localStorage.getItem(key) || '';
        }
      }
      return JSON.stringify(data);
    } catch (error) {
      console.error('Error exporting localStorage data:', error);
      return '{}';
    }
  }

  importData(dataString: string, overwrite: boolean = false): boolean {
    try {
      const data = JSON.parse(dataString);
      
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          if (overwrite || !this.exists(key)) {
            this.setItem(key, data[key]);
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error importing localStorage data:', error);
      return false;
    }
  }

  // Utility methods
  private safeParseJSON(value: string): any {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // Watch for changes in specific keys
  watchKey(key: string): Observable<any> {
    return new Observable(observer => {
      const subscription = this.storageEvents$.subscribe(event => {
        if (event && (event.key === key || event.key === '*')) {
          observer.next(event.newValue);
        }
      });

      // Emit initial value
      const initialValue = this.getItem(key);
      if (initialValue !== null) {
        observer.next(this.safeParseJSON(initialValue));
      }

      return () => subscription.unsubscribe();
    });
  }

  // Browser storage support check
  isStorageAvailable(): boolean {
    return this.isBrowser && typeof Storage !== 'undefined';
  }

  // Get storage quota information (if supported)
  async getStorageQuota(): Promise<{ used: number; quota: number } | null> {
    if (!this.isBrowser || !navigator.storage || !navigator.storage.estimate) {
      return null;
    }

    try {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0
      };
    } catch (error) {
      console.error('Error getting storage quota:', error);
      return null;
    }
  }
}
