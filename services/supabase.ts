
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lwpwcsioclfxxvrgoxmv.supabase.co';
const SUPABASE_KEY = 'sb_secret_XLYY_xWaqDWhuHb9SuKtGQ_K60-nHc1'; // Clé intégrée nativement

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
