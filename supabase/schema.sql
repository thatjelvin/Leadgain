CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  niche TEXT NOT NULL,
  location TEXT NOT NULL,
  company_size TEXT,
  lead_count_requested INT DEFAULT 50,
  lead_count_found INT DEFAULT 0,
  email_priority TEXT DEFAULT 'owner_first',
  status TEXT DEFAULT 'pending',
  current_step TEXT DEFAULT 'discovery',
  status_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own searches" ON search_history;
CREATE POLICY "Users see own searches" ON search_history
  FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS lead_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID REFERENCES search_history(id) ON DELETE CASCADE,
  business_name TEXT,
  owner_first_name TEXT,
  owner_last_name TEXT,
  email TEXT,
  email_type TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  phone TEXT,
  website TEXT,
  location TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lead_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own leads" ON lead_results;
CREATE POLICY "Users see own leads" ON lead_results
  FOR ALL USING (
    search_id IN (
      SELECT id FROM search_history WHERE user_id = auth.uid()
    )
  );
