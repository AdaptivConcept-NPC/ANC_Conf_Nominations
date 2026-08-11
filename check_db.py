import urllib.request
import json

SUPABASE_URL = 'https://zilabbyqoaivtgqdeijd.supabase.co'
SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppbGFiYnlxb2FpdnRncWRlaWpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDM3NTU4NCwiZXhwIjoyMDk5OTUxNTg0fQ.YXd6Dv15ci-dHOZre6h7XSFNTJX4OqH3onxbLTRkUog'

headers = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json'
}

def supabase_get(table, params=''):
    req = urllib.request.Request(
        f'{SUPABASE_URL}/rest/v1/{table}?{params}',
        headers=headers
    )
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read().decode())

# Get candidates
candidates = supabase_get('candidates', 'select=id,full_name,is_active&order=full_name')
print(f'Total candidates in DB: {len(candidates)}')
for c in candidates:
    print(f"  {c['id']}: {c['full_name']}")

print()

# Get wards
wards = supabase_get('wards', 'select=id,ward_number,zone_id&order=ward_number')
print(f'Total wards in DB: {len(wards)}')
for w in wards[:10]:
    print(f"  Ward {w['ward_number']} (id={w['id']}, zone_id={w['zone_id']})")
if len(wards) > 10:
    print(f"  ... and {len(wards) - 10} more")

print()

# Get zones
zones = supabase_get('zones', 'select=id,name&order=name')
print(f'Total zones in DB: {len(zones)}')
for z in zones:
    print(f"  {z['id']}: {z['name']}")

print()

# Get nominations with candidate and ward info
nominations = supabase_get(
    'nominations',
    'select=id,vote_count,ward_id,candidate_id&order=candidate_id,ward_id'
)
print(f'Total nominations in DB: {len(nominations)}')

# Build lookup maps
candidate_map = {c['id']: c['full_name'] for c in candidates}
zone_map = {z['id']: z['name'] for z in zones}

# Get ward-zone mapping
ward_zone = {}
for w in wards:
    zone_name = zone_map.get(w['zone_id'], 'UNKNOWN')
    ward_zone[w['id']] = (w['ward_number'], zone_name)

# Aggregate votes by candidate (total across all wards)
candidate_totals = {}
for nom in nominations:
    cand_name = candidate_map.get(nom['candidate_id'], 'UNKNOWN')
    candidate_totals[cand_name] = candidate_totals.get(cand_name, 0) + nom['vote_count']

print()
print('=== Vote totals by candidate in DB ===')
for name, total in sorted(candidate_totals.items(), key=lambda x: -x[1]):
    print(f"  {name}: {total}")

print()
print(f"Grand total votes in DB: {sum(candidate_totals.values())}")
