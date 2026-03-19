/*
  Warnings:

  - You are about to drop the column `updated_at` on the `do_accounts` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `linode_accounts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `do_accounts` DROP COLUMN `updated_at`,
    MODIFY `cost_query_enabled` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `linode_accounts` DROP COLUMN `updated_at`,
    MODIFY `cost_query_enabled` BOOLEAN NOT NULL DEFAULT true;
