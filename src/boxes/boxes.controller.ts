import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { PERMISSIONS } from '../access/permissions';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { SessionAuthGuard } from '../auth/auth.service';
import { BoxesService } from './boxes.service';
import { AssignBoxItemsDto } from './dto/assign-box-items.dto';
import { CreateBoxDto } from './dto/create-box.dto';
import { ListBoxesQueryDto } from './dto/list-boxes-query.dto';
import { UpdateBoxDto } from './dto/update-box.dto';

type AuthenticatedRequest = {
  user?: {
    id: string;
  };
};

@Controller('boxes')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class BoxesController {
  constructor(private readonly boxesService: BoxesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.BOXES_READ)
  async listBoxes(@Query() query: ListBoxesQueryDto): Promise<{ boxes: unknown[] }> {
    const boxes = await this.boxesService.listBoxes(query);
    return { boxes };
  }

  @Get(':boxId')
  @RequirePermissions(PERMISSIONS.BOXES_READ)
  async getBox(@Param('boxId') boxId: string): Promise<{ box: unknown }> {
    const box = await this.boxesService.getBox(boxId);
    return { box };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.BOXES_WRITE)
  async createBox(
    @Body() body: CreateBoxDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ box: unknown }> {
    const box = await this.boxesService.createBox(body, request.user?.id ?? null);
    return { box };
  }

  @Patch(':boxId')
  @RequirePermissions(PERMISSIONS.BOXES_WRITE)
  async updateBox(
    @Param('boxId') boxId: string,
    @Body() body: UpdateBoxDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ box: unknown }> {
    const box = await this.boxesService.updateBox(boxId, body, request.user?.id ?? null);
    return { box };
  }

  @Put(':boxId/items')
  @RequirePermissions(PERMISSIONS.BOXES_WRITE)
  async assignBoxItems(
    @Param('boxId') boxId: string,
    @Body() body: AssignBoxItemsDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ assignment: unknown }> {
    const assignment = await this.boxesService.assignBoxItems(boxId, body, request.user?.id ?? null);
    return { assignment };
  }

  @Delete(':boxId')
  @RequirePermissions(PERMISSIONS.BOXES_WRITE)
  async deleteBox(
    @Param('boxId') boxId: string,
    @Req() request: AuthenticatedRequest
  ): Promise<{ deleted: true; id: string }> {
    return this.boxesService.deleteBox(boxId, request.user?.id ?? null);
  }
}
