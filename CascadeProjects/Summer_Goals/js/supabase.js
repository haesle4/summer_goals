import { SUPABASE_CONFIG } from '../config.js';

const { createClient } = window.supabase;
export const supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
