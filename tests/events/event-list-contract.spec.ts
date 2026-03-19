import { EventItemStatus } from '@prisma/client';
import { EventsService } from '../../src/events/events.service';
import { createEventsHarness } from './fixtures/events-harness';

describe('Event list contract and box metadata', () => {
  it('returns newest eventDate first and provides boxWarning / No box metadata', async () => {
    const harness = createEventsHarness();
    const auditService = { record: jest.fn(async () => undefined) };
    const service = new EventsService(harness.prisma as never, auditService as never);

    const olderEvent = await service.createEvent(
      {
        name: 'Older Event',
        eventDate: '2026-04-01T10:00:00.000Z',
        location: 'Hall A'
      },
      'admin-1'
    );
    const newerEvent = await service.createEvent(
      {
        name: 'Newer Event',
        eventDate: '2026-04-10T10:00:00.000Z',
        location: 'Hall B'
      },
      'admin-1'
    );

    const withBox = await service.addEventItem(
      String(newerEvent.id),
      { itemId: harness.items[0].id, plannedQuantity: 2 },
      'admin-1'
    );
    const withoutBox = await service.addEventItem(
      String(newerEvent.id),
      { itemId: harness.items[1].id, plannedQuantity: 1 },
      'admin-1'
    );

    const withBoxRecord = harness.eventItems.find((row) => row.id === withBox.id);
    if (withBoxRecord) {
      withBoxRecord.boxCode = 'BOX-001';
    }

    await service.activateEvent(String(newerEvent.id), 'admin-1');

    const list = await service.listEvents();
    expect(list[0].id).toBe(newerEvent.id);
    expect(list[1].id).toBe(olderEvent.id);

    const detail = await service.getEvent(String(newerEvent.id), {});
    const detailItems = detail.items as Array<Record<string, unknown>>;
    const first = detailItems.find((entry) => entry.id === withBox.id);
    const second = detailItems.find((entry) => entry.id === withoutBox.id);

    expect(first?.boxCode).toBe('BOX-001');
    expect(first?.boxWarning).toBeNull();

    expect(second?.boxCode).toBeNull();
    expect(second?.boxLabel).toBe('No box');
    expect(second?.boxWarning).toBe('NO_BOX_LINK');
  });

  it('supports unresolvedOnly and status filters for packing tabs', async () => {
    const harness = createEventsHarness();
    const auditService = { record: jest.fn(async () => undefined) };
    const service = new EventsService(harness.prisma as never, auditService as never);

    const event = await service.createEvent(
      {
        name: 'Filtered Event',
        eventDate: '2026-04-05T10:00:00.000Z',
        location: 'Hall A'
      },
      'admin-1'
    );

    const first = await service.addEventItem(
      String(event.id),
      { itemId: harness.items[0].id, plannedQuantity: 2 },
      'admin-1'
    );
    const second = await service.addEventItem(
      String(event.id),
      { itemId: harness.items[1].id, plannedQuantity: 1 },
      'admin-1'
    );

    await service.activateEvent(String(event.id), 'admin-1');
    await service.updateItemStatus(
      String(event.id),
      String(first.id),
      { status: EventItemStatus.PACKED },
      'admin-1'
    );
    await service.updateItemStatus(
      String(event.id),
      String(first.id),
      { status: EventItemStatus.RETURNED },
      'admin-1'
    );

    const unresolvedOnly = await service.getEvent(String(event.id), { unresolvedOnly: true });
    expect((unresolvedOnly.items as unknown[])).toHaveLength(1);
    expect((unresolvedOnly.items as Array<Record<string, unknown>>)[0].id).toBe(second.id);

    const returnedOnly = await service.getEvent(String(event.id), {
      status: EventItemStatus.RETURNED
    });
    expect((returnedOnly.items as unknown[])).toHaveLength(1);
    expect((returnedOnly.items as Array<Record<string, unknown>>)[0].id).toBe(first.id);
  });
});
