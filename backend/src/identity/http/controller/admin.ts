import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { SystemAdminGuard } from '@/identity/http/guards/system-admin.guard'
import { ProvisionPropertyService } from '@/identity/core/service/provision-property'
import { CreatePropertyDto } from '@/identity/http/dto/create-property'

@Controller('admin')
export class AdminController {
  constructor(private readonly provisionProperty: ProvisionPropertyService) {}

  @UseGuards(SystemAdminGuard)
  @Post('properties')
  @HttpCode(HttpStatus.CREATED)
  async createProperty(@Body() dto: CreatePropertyDto) {
    const result = await this.provisionProperty.handle({
      name: dto.name,
      type: dto.type,
      adminEmail: dto.adminEmail,
      adminName: dto.adminName,
    })

    if (result.isErr()) throw result.error
    return result.value
  }
}
