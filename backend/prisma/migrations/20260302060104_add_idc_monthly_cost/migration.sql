-- CreateTable
CREATE TABLE `idc_monthly_costs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `idc_registration_id` INTEGER NOT NULL,
    `cost` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `idc_monthly_costs_year_month_idc_registration_id_key`(`year`, `month`, `idc_registration_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `idc_monthly_costs` ADD CONSTRAINT `idc_monthly_costs_idc_registration_id_fkey` FOREIGN KEY (`idc_registration_id`) REFERENCES `idc_registrations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
