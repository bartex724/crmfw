import { EventItemStatus } from '@prisma/client';
import { EventsService } from '../../src/events/events.service';
import { createEventsHarness } from './fixtures/events-harness';

describe('Event item status/bulk transitions', () => {
  it('supports guarded transitions and forceToPack override', async () => {
    const harness = createEventsHarness();
    const auditService = { record: jest.fn(async () => undefined) };
    const service = new EventsService(harness.prisma as never, auditService as never);

    const event = await service.createEvent(
      {
        name: 'Main Expo',
        eventDate: '2026-04-05T10:00:00.000Z',
        location: 'Hall A'
      },
      'admin-1'
    );

    const row = await service.addEventItem(
      String(event.id),
      { itemId: harness.items[0].id, plannedQuantity: 2 },
      'admin-1'
    );

    await service.activateEvent(String(event.id), 'admin-1');

    await expect(
      service.updateItemStatus(
        String(event.id),
        String(row.id),
        {
          status: EventItemStatus.RETURNED
        },
        'admin-1'
      )
    ).rejects.toThrow('Invalid status transition');

    const packed = await service.updateItemStatus(
      String(event.id),
      String(row.id),
      {
        status: EventItemStatus.PACKED
      },
      'admin-1'
    );
    expect(packed.status).toBe('PACKED');

    const returned = await service.updateItemStatus(
      String(event.id),
      String(row.id),
      {
        status: EventItemStatus.RETURNED
      },
      'admin-1'
    );
    expect(returned.status).toBe('RETURNED');

    await expect(
      service.updateItemStatus(
        String(event.id),
        String(row.id),
        {
          status: EventItemStatus.TO_PACK
        },
        'admin-1'
      )
    ).rejects.toThrow('forceToPack=true');

    const forced = await service.updateItemStatus(
      String(event.id),
      String(row.id),
      {
        status: EventItemStatus.TO_PACK,
        forceToPack: true
      },
      'admin-1'
    );
    expect(forced.status).toBe('TO_PACK');
  });

  it('enforces event scope and status/bulk updates for selected rows only', async () => {
    const harness = createEventsHarness();
    const auditService = { record: jest.fn(async () => undefined) };
    const service = new EventsService(harness.prisma as never, auditService as never);

    const firstEvent = await service.createEvent(
      {
        name: 'Event One',
        eventDate: '2026-04-05T10:00:00.000Z',
        location: 'Hall A'
      },
      'admin-1'
    );
    const secondEvent = await service.createEvent(
      {
        name: 'Event Two',
        eventDate: '2026-04-07T10:00:00.000Z',
        location: 'Hall B'
      },
      'admin-1'
    );

    const firstRow = await service.addEventItem(
      String(firstEvent.id),
      { itemId: harness.items[0].id, plannedQuantity: 1 },
      'admin-1'
    );
    const secondRow = await service.addEventItem(
      String(firstEvent.id),
      { itemId: harness.items[1].id, plannedQuantity: 1 },
      'admin-1'
    );
    const foreignRow = await service.addEventItem(
      String(secondEvent.id),
      { itemId: harness.items[2].id, plannedQuantity: 1 },
      'admin-1'
    );

    await service.activateEvent(String(firstEvent.id), 'admin-1');
    await service.activateEvent(String(secondEvent.id), 'admin-1');

    await expect(
      service.updateItemStatus(
        String(firstEvent.id),
        String(foreignRow.id),
        {
          status: EventItemStatus.PACKED
        },
        'admin-1'
      )
    ).rejects.toThrow('Event item not found in this event');

    const rows = await service.bulkUpdateItemStatus(
      String(firstEvent.id),
      {
        eventItemIds: [String(firstRow.id), String(secondRow.id)],
        status: EventItemStatus.PACKED
      },
      'admin-1'
    );

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.status === 'PACKED')).toBe(true);
  });

  it('marks Loss without stock mutation and does not alter Item.quantity', async () => {
    const harness = createEventsHarness();
    const auditService = { record: jest.fn(async () => undefined) };
    const service = new EventsService(harness.prisma as never, auditService as never);

    const event = await service.createEvent(
      {
        name: 'Main Expo',
        eventDate: '2026-04-05T10:00:00.000Z',
        location: 'Hall A'
      },
      'admin-1'
    );
    const row = await service.addEventItem(
      String(event.id),
      { itemId: harness.items[0].id, plannedQuantity: 1 },
      'admin-1'
    );
    await service.activateEvent(String(event.id), 'admin-1');

    const beforeQuantity = harness.items[0].quantity;
    await service.updateItemStatus(
      String(event.id),
      String(row.id),
      { status: EventItemStatus.PACKED },
      'admin-1'
    );
    await service.updateItemStatus(
      String(event.id),
      String(row.id),
      { status: EventItemStatus.LOSS },
      'admin-1'
    );

    expect(harness.items[0].quantity).toBe(beforeQuantity);
    expect(harness.prisma.stockAdjustment.create).not.toHaveBeenCalled();
  });
});
