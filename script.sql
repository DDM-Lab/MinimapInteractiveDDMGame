CREATE TABLE `game`(
    `id` INT(6) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `condition` INT(6) NOT NULL, 
    `userid` VARCHAR(50) NOT NULL,
    `episode` INT(6) NOT NULL,
    `target` VARCHAR(20),
    `target_pos` VARCHAR(6),
    `num_step` INT(6),
    `time_spent` VARCHAR(20),
    `trajectory` MEDIUMTEXT,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)
