-- Data seed for local development.

INSERT INTO zones (name, coordinator_name)
VALUES
  ('AMON NGULELE', 'Amon Ngulele'),
  ('ANDREW MAPHETO', 'Andrew Mapheto'),
  ('ZONE 10', 'Zone 10 Coordinator'),
  ('SELOPE THEMA', 'Selope Thema'),
  ('OSKA MABIKA', 'Oska Mabika')
ON CONFLICT (name) DO UPDATE SET
  coordinator_name = EXCLUDED.coordinator_name,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO wards (ward_number, zone_id)
VALUES
  (10, (SELECT id FROM zones WHERE name = 'AMON NGULELE')),
  (11, (SELECT id FROM zones WHERE name = 'AMON NGULELE')),
  (14, (SELECT id FROM zones WHERE name = 'AMON NGULELE')),
  (1, (SELECT id FROM zones WHERE name = 'ANDREW MAPHETO')),
  (2, (SELECT id FROM zones WHERE name = 'ANDREW MAPHETO')),
  (48, (SELECT id FROM zones WHERE name = 'ZONE 10')),
  (59, (SELECT id FROM zones WHERE name = 'ZONE 10')),
  (72, (SELECT id FROM zones WHERE name = 'SELOPE THEMA')),
  (74, (SELECT id FROM zones WHERE name = 'SELOPE THEMA')),
  (26, (SELECT id FROM zones WHERE name = 'OSKA MABIKA')),
  (65, (SELECT id FROM zones WHERE name = 'OSKA MABIKA'))
ON CONFLICT (ward_number) DO UPDATE SET
  zone_id = EXCLUDED.zone_id,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO candidates (full_name)
VALUES
  ('DOCTOR XHAKAZA'),
  ('Jean Sethato'),
  ('Nomadlozi Nkosi'),
  ('Jongizwe Dlabathi'),
  ('Phelisa Nkunjana'),
  ('Dora Mlambo')
ON CONFLICT (full_name) DO UPDATE SET
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO candidate_profiles (candidate_id, display_name, status)
VALUES
  ((SELECT id FROM candidates WHERE full_name = 'DOCTOR XHAKAZA'), 'DOCTOR XHAKAZA', 'active'),
  ((SELECT id FROM candidates WHERE full_name = 'Jean Sethato'), 'Jean Sethato', 'active'),
  ((SELECT id FROM candidates WHERE full_name = 'Nomadlozi Nkosi'), 'Nomadlozi Nkosi', 'active'),
  ((SELECT id FROM candidates WHERE full_name = 'Jongizwe Dlabathi'), 'Jongizwe Dlabathi', 'active'),
  ((SELECT id FROM candidates WHERE full_name = 'Phelisa Nkunjana'), 'Phelisa Nkunjana', 'active'),
  ((SELECT id FROM candidates WHERE full_name = 'Dora Mlambo'), 'Dora Mlambo', 'active')
ON CONFLICT (candidate_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  status = EXCLUDED.status,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO candidate_aliases (candidate_id, alias_name, source_note)
VALUES
  ((SELECT id FROM candidates WHERE full_name = 'DOCTOR XHAKAZA'), 'DOCTOR XHAKZA', 'Workbook typo variant'),
  ((SELECT id FROM candidates WHERE full_name = 'Jean Sethato'), 'Jean sethato', 'Workbook case variant'),
  ((SELECT id FROM candidates WHERE full_name = 'Nomadlozi Nkosi'), 'Nomadlozi nkosi', 'Workbook case variant')
ON CONFLICT (alias_name) DO UPDATE SET
  source_note = EXCLUDED.source_note;

-- NOTE: All vote_count values are 1 (binary) per the authoritative voting rules in
-- docs/voting-rules.md. The original transfer data contained values > 1 which violated
-- Rule 2 (max 1 vote per candidate per ward). Those have been corrected here.
-- Actual ward results must be submitted via the Admin CMS bulk upload or manual capture form.
INSERT INTO nominations (ward_id, candidate_id, vote_count)
VALUES
  ((SELECT id FROM wards WHERE ward_number = 10), (SELECT id FROM candidates WHERE full_name = 'DOCTOR XHAKAZA'), 1),
  ((SELECT id FROM wards WHERE ward_number = 10), (SELECT id FROM candidates WHERE full_name = 'Jean Sethato'), 1),
  ((SELECT id FROM wards WHERE ward_number = 10), (SELECT id FROM candidates WHERE full_name = 'Nomadlozi Nkosi'), 1),
  ((SELECT id FROM wards WHERE ward_number = 11), (SELECT id FROM candidates WHERE full_name = 'DOCTOR XHAKAZA'), 1),
  ((SELECT id FROM wards WHERE ward_number = 11), (SELECT id FROM candidates WHERE full_name = 'Jongizwe Dlabathi'), 1),
  ((SELECT id FROM wards WHERE ward_number = 14), (SELECT id FROM candidates WHERE full_name = 'DOCTOR XHAKAZA'), 1),
  ((SELECT id FROM wards WHERE ward_number = 1), (SELECT id FROM candidates WHERE full_name = 'Jean Sethato'), 1),
  ((SELECT id FROM wards WHERE ward_number = 2), (SELECT id FROM candidates WHERE full_name = 'Nomadlozi Nkosi'), 1),
  ((SELECT id FROM wards WHERE ward_number = 48), (SELECT id FROM candidates WHERE full_name = 'DOCTOR XHAKAZA'), 1),
  ((SELECT id FROM wards WHERE ward_number = 59), (SELECT id FROM candidates WHERE full_name = 'Phelisa Nkunjana'), 1),
  ((SELECT id FROM wards WHERE ward_number = 72), (SELECT id FROM candidates WHERE full_name = 'Jongizwe Dlabathi'), 1),
  ((SELECT id FROM wards WHERE ward_number = 74), (SELECT id FROM candidates WHERE full_name = 'Dora Mlambo'), 1),
  ((SELECT id FROM wards WHERE ward_number = 26), (SELECT id FROM candidates WHERE full_name = 'DOCTOR XHAKAZA'), 1),
  ((SELECT id FROM wards WHERE ward_number = 65), (SELECT id FROM candidates WHERE full_name = 'Jean Sethato'), 1)
ON CONFLICT (ward_id, candidate_id) DO UPDATE SET
  vote_count = EXCLUDED.vote_count,
  updated_at = CURRENT_TIMESTAMP;
