-- CreateTable
CREATE TABLE `server_project_transfers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `server_id` INTEGER NOT NULL,
    `from_project` VARCHAR(100) NOT NULL,
    `to_project` VARCHAR(100) NOT NULL,
    `transfer_date` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `server_project_transfers` ADD CONSTRAINT `server_project_transfers_server_id_fkey` FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
