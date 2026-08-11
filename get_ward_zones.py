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

zones = supabase_get('zones', 'select=id,name')
wards = supabase_get('wards', 'select=id,ward_number,zone_id&order=ward_number')

zone_map = {z['id']: z['name'] for z in zones}

# Group wards by zone
zone_wards = {}
for w in wards:
    zone_name = zone_map.get(w['zone_id'], 'UNKNOWN')
    if zone_name not in zone_wards:
        zone_wards[zone_name] = []
    zone_wards[zone_name].append(w)

print("Wards per zone:")
for zone_name in sorted(zone_wards.keys()):
    ward_list = zone_wards[zone_name]
    ward_nums = [w['ward_number'] for w in ward_list]
    print(f"  {zone_name}: {len(ward_list)} wards -> {ward_nums}")
