import os
from pydantic_settings import BaseSettings
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://teoywqbpxysgppznkwnp.supabase.co")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlb3l3cWJweHlzZ3Bwem5rd25wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTc4MjM4MywiZXhwIjoyMDg1MzU4MzgzfQ.IGUiDEGByFOhjkApjXgodhZtMNX75yBXd9-ViUmCZCE")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_BASE_URL: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    
    UPLOAD_DIR: str = os.path.join(os.path.dirname(__file__), "uploads")
    OUTPUT_DIR: str = os.path.join(os.path.dirname(__file__), "outputs")

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()

# Ensure directories exist
os.makedirs(Settings().UPLOAD_DIR, exist_ok=True)
os.makedirs(Settings().OUTPUT_DIR, exist_ok=True)
