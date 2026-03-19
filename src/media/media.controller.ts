import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PERMISSIONS } from '../access/permissions';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { SessionAuthGuard } from '../auth/auth.service';
import { ReorderPhotosDto } from './dto/reorder-photos.dto';
import { UploadPhotosDto } from './dto/upload-photos.dto';
import { MediaService, type UploadedPhotoFile } from './media.service';

type AuthenticatedRequest = {
  user?: {
    id: string;
  };
};

@Controller('inventory/items')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post(':itemId/photos')
  @RequirePermissions(PERMISSIONS.INVENTORY_WRITE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 15 * 1024 * 1024
      }
    })
  )
  async uploadPhoto(
    @Param('itemId') itemId: string,
    @UploadedFile() file: UploadedPhotoFile | undefined,
    @Body() body: UploadPhotosDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ photo: unknown }> {
    const photo = await this.mediaService.uploadPhoto(itemId, file, body, request.user?.id ?? null);
    return { photo };
  }

  @Get(':itemId/photos')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  async listPhotos(@Param('itemId') itemId: string): Promise<{ photos: unknown[] }> {
    const photos = await this.mediaService.listPhotos(itemId);
    return { photos };
  }

  @Patch(':itemId/photos/:photoId/main')
  @RequirePermissions(PERMISSIONS.INVENTORY_WRITE)
  async setMainPhoto(
    @Param('itemId') itemId: string,
    @Param('photoId') photoId: string,
    @Req() request: AuthenticatedRequest
  ): Promise<{ photo: unknown }> {
    const photo = await this.mediaService.setMainPhoto(itemId, photoId, request.user?.id ?? null);
    return { photo };
  }

  @Patch(':itemId/photos/reorder')
  @RequirePermissions(PERMISSIONS.INVENTORY_WRITE)
  async reorderPhotos(
    @Param('itemId') itemId: string,
    @Body() body: ReorderPhotosDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ photos: unknown[] }> {
    const photos = await this.mediaService.reorderPhotos(itemId, body, request.user?.id ?? null);
    return { photos };
  }

  @Delete(':itemId/photos/:photoId')
  @RequirePermissions(PERMISSIONS.INVENTORY_WRITE)
  async deletePhoto(
    @Param('itemId') itemId: string,
    @Param('photoId') photoId: string,
    @Req() request: AuthenticatedRequest
  ): Promise<{ deleted: true; id: string }> {
    return this.mediaService.deletePhoto(itemId, photoId, request.user?.id ?? null);
  }
}
