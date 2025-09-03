-- Add admin user based on email
-- This migration adds the user with the specified email as an admin

DO $$
DECLARE
    user_uuid uuid;
BEGIN
    -- Find user ID by email (replace with your actual email)
    SELECT id INTO user_uuid 
    FROM auth.users 
    WHERE email = 'franzneandra@gmail.com'  -- Replace with your email
    LIMIT 1;
    
    -- If user found, add them as admin
    IF user_uuid IS NOT NULL THEN
        INSERT INTO public.admin_users (user_id) 
        VALUES (user_uuid)
        ON CONFLICT (user_id) DO NOTHING;  -- Avoid duplicate if already admin
        
        RAISE NOTICE 'Admin user added successfully for email: franzneandra@gmail.com';
    ELSE
        RAISE NOTICE 'User not found with email: franzneandra@gmail.com';
    END IF;
END $$;
