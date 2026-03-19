import { Injectable } from '@nestjs/common';

export const LOGIN_THROTTLE_LIMIT = 5;
export const LOGIN_THROTTLE_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class LoginThrottleService {
  private readonly attempts = new Map<string, number[]>();

  isAllowed(key: string, now: number = Date.now()): boolean {
    const history = this.attempts.get(key) ?? [];
    const windowStart = now - LOGIN_THROTTLE_WINDOW_MS;
    const activeWindow = history.filter((timestamp) => timestamp >= windowStart);

    if (activeWindow.length >= LOGIN_THROTTLE_LIMIT) {
      this.attempts.set(key, activeWindow);
      return false;
    }

    activeWindow.push(now);
    this.attempts.set(key, activeWindow);
    return true;
  }
}

export function loginThrottleKey(ipAddress: string | null, email: string): string {
  return `${ipAddress ?? 'unknown'}:${email.toLowerCase()}`;
}
