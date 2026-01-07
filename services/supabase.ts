
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lwpwcsioclfxxvrgoxmv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_m_D0C4OK3FlE2OuqpEtnbg_qGRrg_UW'; 

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
