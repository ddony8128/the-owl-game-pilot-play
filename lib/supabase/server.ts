import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.warn("Supabase server env vars are not set.");
}

export const createServerSupabaseClient = () => {
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase server env vars are missing");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
    },
  });
};
