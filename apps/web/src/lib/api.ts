import type { AuthUser, BoxRow, Category, EventDetail, EventItemRow, EventRow, Item } from './types';

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
  getEvent: (id: string) =>
    request<{ event: EventDetail; items: EventItemRow[]; statusCounts: Record<string, number> }>(
      `/events/${id}`
    ),
  createEvent: (input: { name: string; eventDate: string; location: string; notes?: string }) =>
    request<{ event: EventRow }>('/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    }),
  activateEvent: (id: string) =>
    request<{ event: EventRow }>(`/events/${id}/activate`, {
      method: 'POST'
    }),
  closeEvent: (id: string) =>
    request<{ event: EventRow }>(`/events/${id}/close`, {
      method: 'POST'
    }),
  reopenEvent: (id: string) =>
    request<{ event: EventRow }>(`/events/${id}/reopen`, {
      method: 'POST'
    }),
  addEventItem: (eventId: string, input: { itemId: string; plannedQuantity: number }) =>
    request<{ item: EventItemRow }>(`/events/${eventId}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    }),
  updateEventItemStatus: (
    eventId: string,
    eventItemId: string,
    input: { status: 'TO_PACK' | 'PACKED' | 'RETURNED' | 'LOSS'; forceToPack?: boolean }
  ) =>
    request<{ item: EventItemRow }>(`/events/${eventId}/items/${eventItemId}/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    }),
  listBoxes: (params?: URLSearchParams) =>
    request<{ boxes: BoxRow[] }>(params ? `/boxes?${params.toString()}` : '/boxes'),
  createBox: (input: { boxCode: string; name: string; notes?: string }) =>
    request<{ box: BoxRow }>('/boxes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    })
};
