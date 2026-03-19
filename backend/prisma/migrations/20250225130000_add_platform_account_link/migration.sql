-- AlterTable
ALTER TABLE `servers` ADD COLUMN `platform_account_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `servers` ADD CONSTRAINT `servers_platform_account_id_fkey` FOREIGN KEY (`platform_account_id`) REFERENCES `platform_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
