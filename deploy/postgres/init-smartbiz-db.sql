-- ==============================================================================
-- SmartBiz Accounting: Dedicated PostgreSQL Database & User Initialization
-- Target Database: smartbiz_db
-- Target User: smartbiz_user
-- ==============================================================================
--
-- HOW TO RUN ON YOUR CONTABO VPS:
--
-- Scenario A: If PostgreSQL runs directly on host (Systemd):
--   sudo -u postgres psql -f deploy/postgres/init-smartbiz-db.sql
--
-- Scenario B: If PostgreSQL runs inside an existing Docker container:
--   docker exec -i <existing_postgres_container_name> psql -U postgres < deploy/postgres/init-smartbiz-db.sql
--
-- ==============================================================================

-- 1. Create dedicated user if not already existing
-- IMPORTANT: Replace 'CHANGE_THIS_TO_A_SECURE_PASSWORD' before running!
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'smartbiz_user') THEN

      CREATE ROLE smartbiz_user LOGIN PASSWORD 'CHANGE_THIS_TO_A_SECURE_PASSWORD';
   END IF;
END
$do$;

-- 2. Create dedicated database owned by smartbiz_user
SELECT 'CREATE DATABASE smartbiz_db OWNER smartbiz_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'smartbiz_db')\gexec

-- 3. Connect to the newly created database and grant schema privileges
\c smartbiz_db

-- Ensure smartbiz_user owns and has full permissions on public schema
GRANT ALL ON SCHEMA public TO smartbiz_user;
ALTER SCHEMA public OWNER TO smartbiz_user;

-- Set default permissions for future tables and sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO smartbiz_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO smartbiz_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO smartbiz_user;

-- Verify setup
SELECT current_database(), current_user;
