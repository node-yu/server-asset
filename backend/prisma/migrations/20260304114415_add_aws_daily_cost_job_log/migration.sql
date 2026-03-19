-- CreateTable
CREATE TABLE `aws_daily_cost_job_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `started_at` DATETIME(3) NOT NULL,
    `finished_at` DATETIME(3) NOT NULL,
    `duration_ms` INTEGER NOT NULL,
    `query_date` VARCHAR(10) NOT NULL,
    `total_count` INTEGER NOT NULL,
    `success_count` INTEGER NOT NULL,
    `failed_count` INTEGER NOT NULL,
    `sync_cost_ok` BOOLEAN NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
