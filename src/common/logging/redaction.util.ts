const SENSITIVE_KEY_PARTS = ['password', 'token', 'authorization', 'cookie', 'session', 'secret', 'sid'];

export function redactSensitive<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitive(entry)) as T;
  }

  if (value && typeof value === 'object') {
    const redacted: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      if (isSensitiveKey(key)) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactSensitive(entry);
      }
    }

    return redacted as T;
  }

  return value;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}
