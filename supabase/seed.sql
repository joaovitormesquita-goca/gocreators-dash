-- =============================================================================
-- SEED DATA — Adapte com valores reais antes de rodar
-- Rode com: psql <DATABASE_URL> -f supabase/seed.sql
-- Ou via Supabase Studio (localhost:54323) > SQL Editor
-- =============================================================================

-- 1. Brands
INSERT INTO brands (name)
SELECT 'Gocase' WHERE NOT EXISTS (SELECT 1 FROM brands WHERE name = 'Gocase');

-- 2. Creators
INSERT INTO creators (full_name, email)
SELECT v.full_name, v.email FROM (VALUES
  ('Camila Jung',  'camisjung@example.com'),
  ('Melb Daily',   'melb@example.com'),
  ('Paola Santos', NULL)
) AS v(full_name, email)
WHERE NOT EXISTS (SELECT 1 FROM creators c WHERE c.full_name = v.full_name);

-- 3. Ad Accounts
INSERT INTO ad_accounts (brand_id, name, meta_account_id)
SELECT b.id, 'Gocase - Principal', 'act_1729945147126309'
FROM brands b WHERE b.name = 'Gocase'
  AND NOT EXISTS (SELECT 1 FROM ad_accounts WHERE meta_account_id = 'act_1729945147126309')
LIMIT 1;

-- 4. Creator Brands (usa subqueries com LIMIT 1 para segurança)
INSERT INTO creator_brands (creator_id, brand_id, handles, start_date) VALUES
  ((SELECT id FROM creators WHERE full_name = 'Camila Jung' LIMIT 1),
   (SELECT id FROM brands WHERE name = 'Gocase' LIMIT 1),
   ARRAY['camisjung', 'camis'], '2025-01-01'),

  ((SELECT id FROM creators WHERE full_name = 'Melb Daily' LIMIT 1),
   (SELECT id FROM brands WHERE name = 'Gocase' LIMIT 1),
   ARRAY['melb', 'melbdaily'], '2025-01-01'),

  ((SELECT id FROM creators WHERE full_name = 'Paola Santos' LIMIT 1),
   (SELECT id FROM brands WHERE name = 'Gocase' LIMIT 1),
   ARRAY['paolla'], '2025-01-01')
ON CONFLICT DO NOTHING;
