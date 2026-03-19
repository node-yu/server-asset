-- CreateTable
CREATE TABLE `do_accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `token` TEXT NULL,
    `notes` TEXT NULL,
    `cost_query_enabled` BOOLEAN NOT NULL DEFAULT false,
    `cost_query_sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `do_accounts_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `do_daily_costs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `account_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `amount` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `do_daily_costs_account_id_date_key`(`account_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `do_costs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `account_id` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `project` VARCHAR(100) NOT NULL,
    `usage` VARCHAR(255) NULL,
    `amount` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `linode_accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `token` TEXT NULL,
    `notes` TEXT NULL,
    `cost_query_enabled` BOOLEAN NOT NULL DEFAULT false,
    `cost_query_sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `linode_accounts_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `linode_daily_costs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `account_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `amount` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `linode_daily_costs_account_id_date_key`(`account_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `linode_costs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `account_id` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `project` VARCHAR(100) NOT NULL,
    `usage` VARCHAR(255) NULL,
    `amount` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `do_daily_costs` ADD CONSTRAINT `do_daily_costs_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `do_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `do_costs` ADD CONSTRAINT `do_costs_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `do_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `linode_daily_costs` ADD CONSTRAINT `linode_daily_costs_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `linode_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `linode_costs` ADD CONSTRAINT `linode_costs_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `linode_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
