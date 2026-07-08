// Base URL for API calls to Supabase Edge Functions.
// In local development, VITE_API_BASE_URL is usually undefined, meaning requests go to '/api/...' 
// which are intercepted and proxied by Vite to the local Supabase instance.
// In production, VITE_API_BASE_URL should be set to your Supabase Edge Function URL.
// Example: VITE_API_BASE_URL="https://<your-project-ref>.supabase.co/functions/v1"
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
