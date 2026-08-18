-- Migration 001: Create base tables
-- This is the initial migration, tables are created in init.sql
-- This file exists for migration tracking purposes

-- Verify tables exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'ci') THEN
        RAISE EXCEPTION 'Table ci not found. Run init.sql first.';
    END IF;
END $$;
