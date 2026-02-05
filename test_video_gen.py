import requests
import json
import time

BASE_URL = "http://localhost:8000/api/video"

def test_full_flow():
    print(f"Testing Video Generation Flow at {BASE_URL}...")
    
    # 1. Generate Video
    print("\n[Step 1] Requesting Video Generation...")
    # gen_url = f"{BASE_URL}/generate"
    # payload = {
    #     "prompt": "小猫在吃鱼 --mode=custom",
    #     "image_url": "https://ark-project.tos-cn-beijing.volces.com/doc_image/seedream4_5_imageToimage.png",
    #     "aspect_ratio": "3:2",
    #     "size": "720P"
    # }
    
    try:
        # response = requests.post(gen_url, json=payload)
        # 
        # if response.status_code != 200:
        #     print(f"Generation Failed: {response.text}")
        #     return
        #     
        # gen_data = response.json()
        # print("Generation Response:", json.dumps(gen_data, indent=2, ensure_ascii=False))
        
        task_id = "grok:d884bf8a-f021-48b2-b2bc-3ac4292868cd"
        # task_id = gen_data.get("data", {}).get("id")
        if not task_id:
            print("No task ID found in response!")
            return
            
        print(f"\n[Step 2] Polling Status for Task ID: {task_id}")
        
        # 2. Poll Status
        for i in range(20):
            status_url = f"{BASE_URL}/status/{task_id}"
            status_res = requests.get(status_url)
            
            if status_res.status_code == 200:
                status_data = status_res.json()
                print(f"Poll {i+1}: Status Response:", json.dumps(status_data, indent=2, ensure_ascii=False))
                
                # Check if task is done (just an example condition)
                task_status = status_data.get("data", {}).get("status")
                if task_status in ["success", "failed"]:
                    break
            else:
                print(f"Poll {i+1} Failed: {status_res.text}")
                
            time.sleep(5)
            
    except Exception as e:
        print(f"Test failed: {e}")

if __name__ == "__main__":
    test_full_flow()
