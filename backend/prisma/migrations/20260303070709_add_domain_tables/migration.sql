-- CreateTable
CREATE TABLE `domains` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `domain` VARCHAR(255) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `create_date` VARCHAR(20) NOT NULL,
    `expire_date` VARCHAR(20) NOT NULL,
    `auto_renew` BOOLEAN NOT NULL DEFAULT false,
    `is_expired` BOOLEAN NOT NULL DEFAULT false,
    `renewal_price` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `domains_domain_provider_key`(`domain`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `domain_sync_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sync_interval_days` INTEGER NOT NULL,
    `last_sync_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
