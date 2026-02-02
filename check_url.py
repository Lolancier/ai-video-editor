
import requests

url = "http://localhost:8000/outputs/edited_c47f95ae-55d8-458c-b362-d2faef6743cb.mp3"
try:
    r = requests.head(url)
    print(f"Status: {r.status_code}")
    print(f"Headers: {r.headers}")
except Exception as e:
    print(f"Error: {e}")
