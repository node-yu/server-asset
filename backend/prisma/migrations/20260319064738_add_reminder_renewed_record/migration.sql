-- CreateTable
CREATE TABLE `reminder_renewed_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(20) NOT NULL,
    `ref_id` INTEGER NOT NULL,
    `expire_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `reminder_renewed_records_type_ref_id_expire_at_key`(`type`, `ref_id`, `expire_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
