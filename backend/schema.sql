-- Gullak database schema (MySQL 5.7+ / MariaDB 10.3+)
-- Run once:  mysql -u root -p < backend/schema.sql

CREATE DATABASE IF NOT EXISTS gullak CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gullak;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id      INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  type    ENUM('income','expense') NOT NULL,
  name    VARCHAR(40) NOT NULL,
  color   CHAR(7)     NOT NULL,
  UNIQUE KEY uq_cat (user_id, type, name),
  CONSTRAINT fk_cat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  type        ENUM('income','expense') NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  txn_date    DATE NOT NULL,
  note        VARCHAR(80) NOT NULL DEFAULT '',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_txn_user_date (user_id, txn_date),
  CONSTRAINT fk_txn_user FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
  CONSTRAINT fk_txn_cat  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- One row per (user, month, expense category). A month's limits apply to later
-- months until a newer month defines its own set.
CREATE TABLE IF NOT EXISTS budgets (
  user_id     INT UNSIGNED NOT NULL,
  period      CHAR(7)      NOT NULL,          -- 'YYYY-MM'
  category_id INT UNSIGNED NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (user_id, period, category_id),
  CONSTRAINT fk_bud_user FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
  CONSTRAINT fk_bud_cat  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;
