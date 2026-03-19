import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { PERMISSIONS } from '../access/permissions';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { SessionAuthGuard } from '../auth/auth.service';
import { AddEventItemDto } from './dto/add-event-item.dto';
import { BulkUpdateEventItemStatusDto } from './dto/bulk-update-event-item-status.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { ListEventItemsQueryDto } from './dto/list-event-items-query.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { UpdateEventItemStatusDto } from './dto/update-event-item-status.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

type AuthenticatedRequest = {
  user?: {
    id: string;
    role: string;
  };
};

@Controller('events')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EVENTS_READ)
  async listEvents(@Query() query: ListEventsQueryDto): Promise<{ events: unknown[] }> {
    const events = await this.eventsService.listEvents(query);
    return { events };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EVENTS_READ)
  async getEvent(
    @Param('id') id: string,
    @Query() query: ListEventItemsQueryDto
  ): Promise<{ event: unknown; items: unknown[]; statusCounts: Record<string, number> }> {
    const result = await this.eventsService.getEvent(id, query);
    return {
      event: result.event,
      items: result.items as unknown[],
      statusCounts: result.statusCounts as Record<string, number>
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EVENTS_WRITE)
  async createEvent(
    @Body() body: CreateEventDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ event: unknown }> {
    const event = await this.eventsService.createEvent(body, request.user?.id ?? null);
    return { event };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EVENTS_WRITE)
  async updateEvent(
    @Param('id') id: string,
    @Body() body: UpdateEventDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ event: unknown }> {
    const event = await this.eventsService.updateEvent(id, body, request.user?.id ?? null);
    return { event };
  }

  @Post(':id/activate')
  @RequirePermissions(PERMISSIONS.EVENTS_WRITE)
  async activateEvent(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest
  ): Promise<{ event: unknown }> {
    const event = await this.eventsService.activateEvent(id, request.user?.id ?? null);
    return { event };
  }

  @Post(':id/close')
  @RequirePermissions(PERMISSIONS.EVENTS_WRITE)
  async closeEvent(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest
  ): Promise<{ event: unknown }> {
    const event = await this.eventsService.closeEvent(id, request.user?.id ?? null);
    return { event };
  }

  @Post(':id/reopen')
  @RequirePermissions(PERMISSIONS.EVENTS_WRITE)
  async reopenEvent(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest
  ): Promise<{ event: unknown }> {
    const event = await this.eventsService.reopenEvent(
      id,
      request.user?.id ?? null,
      request.user?.role ?? null
    );
    return { event };
  }

  @Post(':id/items')
  @RequirePermissions(PERMISSIONS.EVENTS_WRITE)
  async addEventItem(
    @Param('id') id: string,
    @Body() body: AddEventItemDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ item: unknown }> {
    const item = await this.eventsService.addEventItem(id, body, request.user?.id ?? null);
    return { item };
  }

  @Post(':eventId/boxes/:boxId/add')
  @RequirePermissions(PERMISSIONS.EVENTS_WRITE)
  async addBoxToEvent(
    @Param('eventId') eventId: string,
    @Param('boxId') boxId: string,
    @Req() request: AuthenticatedRequest
  ): Promise<{ result: unknown }> {
    const result = await this.eventsService.addBoxToEvent(eventId, boxId, request.user?.id ?? null);
    return { result };
  }

  @Post(':eventId/boxes/:boxId/add-missing')
  @RequirePermissions(PERMISSIONS.EVENTS_WRITE)
  async addMissingBoxItems(
    @Param('eventId') eventId: string,
    @Param('boxId') boxId: string,
    @Req() request: AuthenticatedRequest
  ): Promise<{ result: unknown }> {
    const result = await this.eventsService.addMissingBoxItems(
      eventId,
      boxId,
      request.user?.id ?? null
    );
    return { result };
  }

  @Delete(':eventId/boxes/:boxId')
  @RequirePermissions(PERMISSIONS.EVENTS_WRITE)
  async removeBoxFromEvent(
    @Param('eventId') eventId: string,
    @Param('boxId') boxId: string,
    @Req() request: AuthenticatedRequest
  ): Promise<{ result: unknown }> {
    const result = await this.eventsService.removeBoxFromEvent(eventId, boxId, request.user?.id ?? null);
    return { result };
  }

  @Delete(':id/items/:eventItemId')
  @RequirePermissions(PERMISSIONS.EVENTS_WRITE)
  async removeEventItem(
    @Param('id') id: string,
    @Param('eventItemId') eventItemId: string,
    @Req() request: AuthenticatedRequest
  ): Promise<{ deleted: true; id: string; eventId: string }> {
    return this.eventsService.removeEventItem(id, eventItemId, request.user?.id ?? null);
  }

  @Patch(':eventId/items/:eventItemId/status')
  @RequirePermissions(PERMISSIONS.EVENTS_WRITE)
  async updateItemStatus(
    @Param('eventId') eventId: string,
    @Param('eventItemId') eventItemId: string,
    @Body() body: UpdateEventItemStatusDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ item: unknown }> {
    const item = await this.eventsService.updateItemStatus(
      eventId,
      eventItemId,
      body,
      request.user?.id ?? null
    );
    return { item };
  }

  @Patch(':eventId/items/status/bulk')
  @RequirePermissions(PERMISSIONS.EVENTS_WRITE)
  async bulkUpdateItemStatus(
    @Param('eventId') eventId: string,
    @Body() body: BulkUpdateEventItemStatusDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ items: unknown[] }> {
    const items = await this.eventsService.bulkUpdateItemStatus(eventId, body, request.user?.id ?? null);
    return { items };
  }
}
