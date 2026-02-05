import requests

urls = [
    "https://s.coze.cn/t/dXEO3AZtzyE/",
    "https://s.coze.cn/t/PtSaQnR3XRg/"
]

for url in urls:
    try:
        resp = requests.head(url, allow_redirects=True, timeout=5)
        print(f"URL: {url}")
        print(f"Final URL: {resp.url}")
        print(f"Content-Type: {resp.headers.get('Content-Type')}")
        print("-" * 20)
    except Exception as e:
        print(f"Error checking {url}: {e}")
