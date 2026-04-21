const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function createTestUser() {
  const email = process.env.TEST_USER_EMAIL || 'test_user123@example.com';
  const password = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

  console.log('Creating user...');
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: 'Test Setup User',
    },
  });

  if (error) {
    console.error('Error creating user:', error.message);
  } else {
    console.log('User created successfully:');
    console.log('Email:', email);
    console.log('Password:', password);
    
    // Also create a profile if it doesn't auto-create via trigger
    const userId = data.user.id;
    console.log('User ID:', userId);
    
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        display_name: 'Test Setup User',
        role: 'user', // or admin if you want to test admin features
      });

    if (profileError) {
      console.log('Note: Profile might exist due to trigger or error:', profileError.message);
    } else {
      console.log('Profile ensured.');
    }
  }
}

createTestUser();
