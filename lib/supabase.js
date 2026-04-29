// Shared Supabase client for ops app
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Railway server (for /tasks/rewrite calls)
export const RAILWAY_URL = 'https://casitasenpueblo-agent-production.up.railway.app';
