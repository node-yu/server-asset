-- CreateTable
CREATE TABLE `servers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(100) NOT NULL,
    `hostname` VARCHAR(255) NOT NULL,
    `ip` VARCHAR(45) NOT NULL,
    `password` TEXT NOT NULL,
    `project` VARCHAR(100) NOT NULL,
    `status` VARCHAR(50) NOT NULL,
    `config` TEXT NULL,
    `region` VARCHAR(100) NULL,
    `bandwidth_type` VARCHAR(50) NULL,
    `server_type` VARCHAR(50) NULL,
    `manager` VARCHAR(100) NULL,
    `usage` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cancel_at` DATETIME(3) NULL,
    `monthly_cost` DOUBLE NOT NULL DEFAULT 0,
    `notes` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
