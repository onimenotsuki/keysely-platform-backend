-- Migration: Add 'didit' as valid value for identity_documents.identity_type
-- This allows storing Didit identity verification records in the identity_documents table
-- 
-- The CHECK constraint previously only allowed: 'ine', 'passport', 'professional_id'
-- Now it also allows 'didit' for users who complete identity verification via Didit

-- First, find and drop the existing CHECK constraint
-- Note: The constraint name may vary, so we'll try common names
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Find the constraint name
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'identity_documents'::regclass
      AND contype = 'c'
      AND conname LIKE '%identity_type%';
    
    -- Drop the constraint if it exists
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE identity_documents DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    ELSE
        -- Try alternative approach: drop by checking constraint definition
        -- This handles cases where constraint name doesn't match pattern
        FOR constraint_name IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'identity_documents'::regclass
              AND contype = 'c'
        LOOP
            -- Check if this constraint is related to identity_type
            IF EXISTS (
                SELECT 1
                FROM pg_get_constraintdef(
                    (SELECT oid FROM pg_constraint WHERE conname = constraint_name)
                ) AS def
                WHERE def LIKE '%identity_type%'
            ) THEN
                EXECUTE format('ALTER TABLE identity_documents DROP CONSTRAINT IF EXISTS %I', constraint_name);
                RAISE NOTICE 'Dropped constraint: %', constraint_name;
                EXIT;
            END IF;
        END LOOP;
    END IF;
END $$;

-- Add new CHECK constraint that includes 'didit'
ALTER TABLE identity_documents 
ADD CONSTRAINT identity_documents_identity_type_check 
CHECK (
    identity_type IS NULL 
    OR identity_type IN ('ine', 'passport', 'professional_id', 'didit')
);

-- Add comment to document the change
COMMENT ON CONSTRAINT identity_documents_identity_type_check ON identity_documents IS 
'Validates identity_type values. Allows: ine, passport, professional_id, or didit (for Didit identity verification)';
