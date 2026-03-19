-- CreateTable
CREATE TABLE `monthly_stats_snapshots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `platform` VARCHAR(100) NOT NULL,
    `usage` VARCHAR(255) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `cost` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `monthly_stats_snapshots_year_month_platform_usage_key`(`year`, `month`, `platform`, `usage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
