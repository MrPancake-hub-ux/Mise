/* Mise public settings. Safe to be public: the Supabase "anon" key is designed to be shipped to browsers
   (your data is protected by the row-level-security rules in the setup guide).
   Leave the two Supabase values empty to run in device-only mode. */
window.MISE_CONFIG = {
  SUPABASE_URL: "https://pqnuoyxwaxwrzajfrjsq.supabase.co",        // e.g. https://abcdefgh.supabase.co
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbnVveXh3YXh3cnphamZyanNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NDQ4OTgsImV4cCI6MjEwODQyMDg5OH0.ZgJ5pNMmkB9n1sKdRmghE6rXR_Sr__yp9twc7wi_meQ",   // the "anon public" key (NOT the service_role key)
  GOOGLE_LOGIN: false,     // set to true after enabling the Google provider in Supabase
  TERMS_VERSION: "2026-10",
  CONTACT_EMAIL: ""     // your public contact email, shown on the Privacy and Terms pages
};
