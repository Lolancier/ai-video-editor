import requests
import json
import time

BASE_URL = "http://localhost:8000/api/video"

def test_batch_generate():
    print(f"Testing Batch Video Generation Flow at {BASE_URL}...")
    
    gen_url = f"{BASE_URL}/generate"
    payload = {
        "prompt": "Test batch generation",
        "url_list": [
            "https://s.coze.cn/t/dXEO3AZtzyE/",
            "https://s.coze.cn/t/PtSaQnR3XRg/"
        ],
        "aspect_ratio": "3:2",
        "size": "720P"
    }
    
    try:
        print("\n[Step 1] Requesting Batch Video Generation...")
        response = requests.post(gen_url, json=payload)
        
        if response.status_code != 200:
            print(f"Generation Failed: {response.text}")
            return
            
        data = response.json()
        print("Generation Response:", json.dumps(data, indent=2, ensure_ascii=False))
        
        if data.get("batch"):
            print("Batch mode detected.")
            results = data.get("results", [])
            print(f"Received {len(results)} results.")
            
            for res in results:
                if res['status'] == 'success':
                    print(f"Task ID: {res['data']['id']} for URL: {res['image_url']}")
                else:
                    print(f"Task Failed for URL: {res['image_url']} - {res.get('error')}")
        else:
            print("Response is not in batch format!")

    except Exception as e:
        print(f"Test failed: {e}")

if __name__ == "__main__":
    test_batch_generate()
