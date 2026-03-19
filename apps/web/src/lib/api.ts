import type { AuthUser, BoxRow, Category, EventRow, Item } from './types';

const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

type JsonValue = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
    ...init
  });

  const contentType = response.headers.get('content-type') ?? '';
  let payload: JsonValue = null;

  if (contentType.includes('application/json')) {
    payload = (await response.json()) as JsonValue;
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : ((payload as Record<string, unknown> | null)?.message as string | undefined) ??
          response.statusText;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export const api = {
  me: () => request<{ user: AuthUser }>('/auth/me'),
  login: (input: { email: string; password: string; rememberMe?: boolean }) =>
    request<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    }),
  logout: () =>
    request<{ status: 'ok' }>('/auth/logout', {
      method: 'POST'
    }),
  listCategories: () => request<{ categories: Category[] }>('/inventory/categories'),
  createCategory: (input: { name: string; description?: string }) =>
    request<{ category: Category }>('/inventory/categories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    }),
  listItems: (params: URLSearchParams) => request<{ items: Item[] }>(`/inventory/items?${params.toString()}`),
  createItem: (input: {
    name: string;
    code?: string;
    categoryId: string;
    quantity?: number;
    notes?: string;
  }) =>
    request<{ item: Item }>('/inventory/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    }),
  listEvents: () => request<{ events: EventRow[] }>('/events'),
  listBoxes: () => request<{ boxes: BoxRow[] }>('/boxes')
};
