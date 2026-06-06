/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if variables are valid and not placeholders
const isValidUrl = supabaseUrl && 
  supabaseUrl !== 'YOUR_SUPABASE_URL' && 
  supabaseUrl !== 'YOUR_SUPABASE_PROJECT_URL' && 
  !supabaseUrl.includes('YOUR_SUPABASE');

const isValidKey = supabaseAnonKey && 
  supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY' && 
  supabaseAnonKey !== 'YOUR_SUPABASE_ANON_PUBLIC_KEY' && 
  !supabaseAnonKey.includes('YOUR_SUPABASE');

export const isSupabaseConfigured = Boolean(isValidUrl && isValidKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not configured. ' +
    'The app will run in full-featured Local Mode (using LocalStorage with responsive, fully mock-seeded rankings!).'
  );
}
