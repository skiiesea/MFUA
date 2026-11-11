-- Promote only the explicitly named owner account. No other admin is elevated.
UPDATE "User" SET "role" = 'ROOT_ADMIN' WHERE "username" = 'root_admin';
