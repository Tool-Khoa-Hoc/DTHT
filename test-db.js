import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const t = ['universities', 'majors', 'admission_methods', 'subject_groups', 'admission_benchmarks'];
  for (const table of t) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    console.log(table, ':', error ? error.message : data[0] ? Object.keys(data[0]) : 'empty');
  }
}
test();
