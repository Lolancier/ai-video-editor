import requests

url = "http://localhost:8000/uploads/8261573e-8553-47bc-9bdf-9997822e92cb.mov"

try:
    print(f"Checking HEAD for {url}")
    head_res = requests.head(url)
    print(f"Status: {head_res.status_code}")
    for k, v in head_res.headers.items():
        print(f"{k}: {v}")
        
    print("-" * 20)
    
    print("Checking Range Request (bytes=0-1024)")
    headers = {"Range": "bytes=0-1024"}
    range_res = requests.get(url, headers=headers, stream=True)
    print(f"Status: {range_res.status_code}")
    print(f"Content-Length: {range_res.headers.get('Content-Length')}")
    print(f"Content-Range: {range_res.headers.get('Content-Range')}")
    
    # Read a bit
    chunk = next(range_res.iter_content(1024))
    print(f"Read {len(chunk)} bytes successfully")
    
except Exception as e:
    print(f"Error: {e}")
