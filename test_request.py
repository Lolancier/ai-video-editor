import requests
try:
    res = requests.get("http://localhost:8000/api/video/task/dc2dcaaa-9762-4d4f-8749-7cb3a3469d2e")
    print(res.status_code)
    print(res.text)
except Exception as e:
    print(e)
