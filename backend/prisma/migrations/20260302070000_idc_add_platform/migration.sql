-- AlterTable
ALTER TABLE `idc_region_costs` ADD COLUMN `platform` VARCHAR(100) NOT NULL DEFAULT 'IDC';

-- DropIndex
DROP INDEX `idc_region_costs_year_month_region_key` ON `idc_region_costs`;

-- CreateIndex
CREATE UNIQUE INDEX `idc_region_costs_year_month_platform_region_project_key` ON `idc_region_costs`(`year`, `month`, `platform`, `region`, `project`);
