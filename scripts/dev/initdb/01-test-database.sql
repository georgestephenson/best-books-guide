-- Runs once, on first `docker compose up` (empty data volume). Creates the
-- integration-test database alongside the dev one so `npm test`'s
-- TRUNCATE-between-tests is isolated from local dev data. Migrations create the
-- extensions and tables inside it; this only has to exist.
CREATE DATABASE bestbooks_test OWNER bestbooks;
