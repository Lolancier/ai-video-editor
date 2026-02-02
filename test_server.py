import requests
import sys

def test_tasks():
    try:
        # User ID is required. Assuming a dummy one or one from logs if available.
        # From logs: http://localhost:8000/uploads/8261573e-8553-47bc-9bdf-9997822e92cb.mov
        # We don't have user_id handy, but let's try with a dummy one.
        # The list_user_tasks endpoint requires user_id query param.
        
        user_id = "test_user"
        response = requests.get(f"http://localhost:8000/api/video/tasks?user_id={user_id}")
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:200]}...")
        
        if response.status_code == 200:
            print("Success!")
        else:
            print("Failed!")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_tasks()
