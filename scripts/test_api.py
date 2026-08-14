import requests, os
from dotenv import load_dotenv

load_dotenv()

url = f"https://api.data.gov.in/resource/{os.getenv('DATA_GOV_RESOURCE_ID')}"
params = {
    "api-key": os.getenv("DATA_GOV_API_KEY"),
    "format": "json",
    "filters[state]": os.getenv("CPCB_STATE"),
    "filters[city]": os.getenv("CPCB_CITY"),
    "limit": 100
}
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
}

resp = requests.get(url, params=params, headers=headers)
data = resp.json()

print("Total matching records:", data.get("total"))
print("Records returned:", data.get("count"))

for r in data.get("records", []):
    print(r["station"], "-", r["pollutant_id"], "-", r["avg_value"])