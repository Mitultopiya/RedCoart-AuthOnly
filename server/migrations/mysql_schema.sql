CREATE DATABASE IF NOT EXISTS `travel_hub` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `travel_hub`;

-- If a legacy schema exists with hyphen-like naming conventions, migrate data manually table-by-table.
-- MySQL does not support a literal unquoted schema name containing '-'.

SOURCE ./schema_tables.sql;
