export type AuthUser = {
  id: string;
  email: string;
  role: string;
};

export type Category = {
  id: string;
  name: string;
  description: string | null;
  itemCount?: number;
};

export type Item = {
  id: string;
  name: string;
  code: string;
  quantity: number;
  notes: string | null;
  categoryId: string;
  category: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  isUnavailable: boolean;
};

export type EventRow = {
  id: string;
  name: string;
  eventDate: string;
  lifecycleStatus: string;
  location: string;
  notes?: string | null;
};

export type BoxRow = {
  id: string;
  boxCode: string;
  name: string;
  notes?: string | null;
};

export type EventDetail = {
  id: string;
  name: string;
  eventDate: string;
  location: string;
  notes?: string | null;
  lifecycleStatus: string;
  statusCounts: Record<string, number>;
};

export type EventItemRow = {
  id: string;
  eventId: string;
  itemId: string;
  itemName: string | null;
  itemCode: string | null;
  plannedQuantity: number;
  lostQuantity: number;
  returnedQuantity: number;
  status: 'TO_PACK' | 'PACKED' | 'RETURNED' | 'LOSS';
  statusLabel: string;
  boxCode: string | null;
  boxLabel: string | null;
};

export type ItemPhoto = {
  id: string;
  itemId: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
  isMain: boolean;
  createdAt: string;
  updatedAt: string;
};
