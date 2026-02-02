from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions
from api.config import get_settings
from functools import lru_cache

settings = get_settings()

@lru_cache()
def get_supabase() -> Client:
    # Increase timeout to 60 seconds to handle slow proxy/network
    options = ClientOptions(postgrest_client_timeout=60)
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY, options=options)
