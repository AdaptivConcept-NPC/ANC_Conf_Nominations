"""Check the vote_count constraint on nominations table."""
from supabase import create_client

SUPABASE_URL = 'https://zilabbyqoaivtgqdeijd.supabase.co'
SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppbGFiYnlxb2FpdnRncWRlaWpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDM3NTU4NCwiZXhwIjoyMDk5OTUxNTg0fQ.YXd6Dv15ci-dHOZre6h7XSFNTJX4OqH3onxbLTRkUog'

supabase = create_client(SUPABASE_URL, SERVICE_KEY)

# Get a valid ward_id and candidate_id
wards = supabase.table('wards').select('id').limit(1).execute().data
candidates = supabase.table('candidates').select('id').limit(1).execute().data

if wards and candidates:
    ward_id = wards[0]['id']
    candidate_id = candidates[0]['id']

    # Try inserting with vote_count = 1
    try:
        result = supabase.table('nominations').insert({
            'ward_id': ward_id,
            'candidate_id': candidate_id,
            'vote_count': 1
        }).execute()
        print("Insert with vote_count=1: SUCCESS")
        print(f"  Inserted: {result.data}")

        # Clean up
        supabase.table('nominations').delete().eq('id', result.data[0]['id']).execute()
    except Exception as e:
        print(f"Insert with vote_count=1: FAILED - {e}")

    # Try inserting with vote_count = 2
    try:
        result = supabase.table('nominations').insert({
            'ward_id': ward_id,
            'candidate_id': candidate_id,
            'vote_count': 2
        }).execute()
        print("Insert with vote_count=2: SUCCESS")
        print(f"  Inserted: {result.data}")

        # Clean up
        supabase.table('nominations').delete().eq('id', result.data[0]['id']).execute()
    except Exception as e:
        print(f"Insert with vote_count=2: FAILED - {e}")

    # Try with vote_count = 0
    try:
        result = supabase.table('nominations').insert({
            'ward_id': ward_id,
            'candidate_id': candidate_id,
            'vote_count': 0
        }).execute()
        print("Insert with vote_count=0: SUCCESS")
        print(f"  Inserted: {result.data}")

        # Clean up
        supabase.table('nominations').delete().eq('id', result.data[0]['id']).execute()
    except Exception as e:
        print(f"Insert with vote_count=0: FAILED - {e}")
