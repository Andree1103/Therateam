import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = new BehaviorSubject<Toast[]>([]);
  readonly toasts$ = this._toasts.asObservable();

  success(message: string) { this.add('success', message); }
  error(message: string)   { this.add('error', message); }
  warning(message: string) { this.add('warning', message); }
  info(message: string)    { this.add('info', message); }

  remove(id: number) {
    this._toasts.next(this._toasts.value.filter(t => t.id !== id));
  }

  private add(type: ToastType, message: string) {
    const id = Date.now() + Math.random();
    this._toasts.next([...this._toasts.value, { id, type, message }]);
    setTimeout(() => this.remove(id), 4200);
  }
}
