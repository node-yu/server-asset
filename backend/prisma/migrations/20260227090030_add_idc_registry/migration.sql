-- CreateTable
CREATE TABLE `idc_registrations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `platform_account_id` INTEGER NOT NULL,
    `region` VARCHAR(100) NOT NULL,
    `config` VARCHAR(100) NOT NULL,
    `server_count` INTEGER NOT NULL DEFAULT 0,
    `bandwidth` INTEGER NOT NULL DEFAULT 0,
    `bandwidth_cost` DOUBLE NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `idc_adjustments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `idc_registration_id` INTEGER NOT NULL,
    `adjustment_date` DATETIME(3) NOT NULL,
    `server_count_delta` INTEGER NOT NULL DEFAULT 0,
    `bandwidth_delta` INTEGER NOT NULL DEFAULT 0,
    `note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `idc_registrations` ADD CONSTRAINT `idc_registrations_platform_account_id_fkey` FOREIGN KEY (`platform_account_id`) REFERENCES `platform_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `idc_adjustments` ADD CONSTRAINT `idc_adjustments_idc_registration_id_fkey` FOREIGN KEY (`idc_registration_id`) REFERENCES `idc_registrations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
