import { createClient } from '@supabase/supabase-js';

// Replace with your Supabase project credentials
const SUPABASE_URL = 'https://rrgoynmjhkcqloavvfco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ295bm1qaGtjcWxvYXZ2ZmNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTc5NTgsImV4cCI6MjA5MjkzMzk1OH0.mk1cAwmm2LBPm6TKxqWpQTxsUgZavSue8-dLUoSh1Zw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// NOTE: The Flask backend URL/IP is configured in one place only — src/services/api.js
// (ANDROID_IP). Do not redefine it here to avoid conflicting values.