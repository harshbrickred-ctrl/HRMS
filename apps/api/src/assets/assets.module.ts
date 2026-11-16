import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RbacModule } from '../rbac/rbac.module';
import { AssetAllocationsController } from './asset-allocations.controller';
import { AssetAllocationsService } from './asset-allocations.service';
import { AssetCategoriesController } from './asset-categories.controller';
import { AssetCategoriesService } from './asset-categories.service';
import { AssetMaintenanceService } from './asset-maintenance.service';
import { AssetOperationsController } from './asset-operations.controller';
import { AssetReportsService } from './asset-reports.service';
import { AssetRequestsService } from './asset-requests.service';
import { AssetSelfService } from './asset-self.service';
import { AssetSheetService } from './asset-sheet.service';
import { AssetSupport } from './asset-support.service';
import { AssetsSelfController } from './assets-self.controller';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';

@Module({
  imports: [RbacModule, NotificationsModule],
  // Literal routes such as assets/me and assets/requests must register before assets/:id.
  controllers: [
    AssetsSelfController,
    AssetCategoriesController,
    AssetOperationsController,
    AssetAllocationsController,
    AssetsController,
  ],
  providers: [
    AssetSupport,
    AssetCategoriesService,
    AssetMaintenanceService,
    AssetAllocationsService,
    AssetRequestsService,
    AssetReportsService,
    AssetSelfService,
    AssetsService,
    AssetSheetService,
  ],
})
export class AssetsModule {}
