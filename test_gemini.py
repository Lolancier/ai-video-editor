
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

def test_gemini():
    api_key = os.getenv("GOOGLE_API_KEY")
    print(f"Testing Gemini with Key: {api_key[:10] if api_key else 'None'}...")
    
    if not api_key:
        print("Error: No API Key found.")
        return

    genai.configure(api_key=api_key)

    models_to_try = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"]
    
    for model_name in models_to_try:
        print(f"\n--- Testing Model: {model_name} ---")
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content("Hello, can you hear me?")
            print(f"Success! Response: {response.text}")
            return
        except Exception as e:
            print(f"Failed: {e}")

if __name__ == "__main__":
    test_gemini()
