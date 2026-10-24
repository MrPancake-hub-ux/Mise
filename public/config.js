/* Mise public settings. Safe to be public: the Supabase "anon" key is designed to be shipped to browsers
   (your data is protected by the row-level-security rules in the setup guide).
   Leave the two Supabase values empty to run in device-only mode. */
window.MISE_CONFIG = {
  SUPABASE_URL: "",        // e.g. https://abcdefgh.supabase.co
  SUPABASE_ANON_KEY: "",   // the "anon public" key (NOT the service_role key)
  GOOGLE_LOGIN: false,     // set to true after enabling the Google provider in Supabase
  TERMS_VERSION: "2026-10",
  CONTACT_EMAIL: ""     // your public contact email, shown on the Privacy and Terms pages
};
