try:
    from openai import OpenAI
    print("OpenAI imported successfully")
    import moviepy.editor as mp
    print("MoviePy imported successfully")
    from supabase import create_client
    print("Supabase imported successfully")
except Exception as e:
    print(f"Import failed: {e}")
