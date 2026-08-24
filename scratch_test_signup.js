const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSignup() {
  console.log('Attempting signup...');
  const { data, error } = await supabase.auth.signUp({
    email: 'test_signup_error_' + Date.now() + '@example.com',
    password: 'password123',
    options: {
      data: {
        username: 'testuser_' + Date.now(),
        display_name: 'Test User',
        gender: 'male',
      }
    }
  });

  if (error) {
    console.error('Signup Error:', error);
  } else {
    console.log('Signup Success:', data.user?.id);
  }
}

testSignup();
