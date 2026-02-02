import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://teoywqbpxysgppznkwnp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlb3l3cWJweHlzZ3Bwem5rd25wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3ODIzODMsImV4cCI6MjA4NTM1ODM4M30.pZrAr2cDOPpEvxScpwgHXWG1qfIXykYjl0rNZ8VrrFY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
