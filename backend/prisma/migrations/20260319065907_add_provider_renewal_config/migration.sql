-- CreateTable
CREATE TABLE `provider_renewal_configs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider` VARCHAR(100) NOT NULL,
    `renewal_type` VARCHAR(30) NOT NULL,
    `day_of_month` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `provider_renewal_configs_provider_key`(`provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
