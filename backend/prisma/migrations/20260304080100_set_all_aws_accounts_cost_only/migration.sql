-- 将所有 AWS 账号状态设为「仅查询费用」
UPDATE `aws_accounts` SET `cost_query_status` = 'cost_only';
