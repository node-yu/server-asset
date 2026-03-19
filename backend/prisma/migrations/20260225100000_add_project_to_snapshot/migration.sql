-- AlterTable
ALTER TABLE `monthly_stats_snapshots` ADD COLUMN `project` VARCHAR(100) NOT NULL DEFAULT '';

-- DropIndex
DROP INDEX `monthly_stats_snapshots_year_month_platform_usage_key` ON `monthly_stats_snapshots`;

-- CreateIndex
CREATE UNIQUE INDEX `monthly_stats_snapshots_year_month_project_platform_usage_key` ON `monthly_stats_snapshots`(`year`, `month`, `project`, `platform`, `usage`);
