-- Migration to fix spelling of Vaishnavi's username from "rajbhr" to "rajbhar"
-- This corrects the username in the department_users table

-- Update username from "vaishnavi rajbhr" to "vaishnavi rajbhar"
-- Using case-insensitive matching to catch any variations
UPDATE department_users
SET username = 'Vaishnavi Rajbhar'
WHERE LOWER(username) LIKE '%vaishnavi%rajbhr%'
   OR LOWER(username) = 'vaishnavi rajbhr'
   OR email = 'VAISHNAVI@anocab.com'
   OR LOWER(email) = 'vaishnavi@anocab.com';

-- Also update if the username is stored in a different format
UPDATE department_users
SET username = 'Vaishnavi Rajbhar'
WHERE (LOWER(username) LIKE '%rajbhr%' AND LOWER(username) LIKE '%vaishnavi%')
   OR (LOWER(username) LIKE '%rajbhr%' AND email = 'VAISHNAVI@anocab.com');

-- Verify the update (this won't affect the database, just for reference)
-- SELECT username, email FROM department_users WHERE LOWER(email) LIKE '%vaishnavi%' OR LOWER(username) LIKE '%vaishnavi%';


