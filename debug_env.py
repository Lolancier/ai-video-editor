from api.config import get_settings
import os

settings = get_settings()
print(f"DEBUG: VIDEO_GEN_API_KEY from settings: '{settings.VIDEO_GEN_API_KEY}'")
print(f"DEBUG: VIDEO_GEN_API_KEY from os.environ: '{os.environ.get('VIDEO_GEN_API_KEY')}'")
print(f"DEBUG: CWD: {os.getcwd()}")
