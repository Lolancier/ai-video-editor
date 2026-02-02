-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, password_hash, name)
  VALUES (
    new.id,
    new.email,
    'managed_by_supabase_auth', -- Placeholder as password is in auth.users
    COALESCE(new.raw_user_meta_data->>'name', new.email) -- Use name from metadata or fallback to email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Optional: Fix for existing users (Run this manually if needed, or include it here)
-- This part attempts to backfill public.users from auth.users
INSERT INTO public.users (id, email, password_hash, name)
SELECT 
  id, 
  email, 
  'managed_by_supabase_auth',
  COALESCE(raw_user_meta_data->>'name', email)
FROM auth.users
ON CONFLICT (id) DO NOTHING;
