import requests, os, json
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("OPENAQ_API_KEY")
HEADERS = {"X-API-Key": API_KEY}

# Just check one known Pune location: Katraj Dairy (id 3409438)
resp = requests.get(
    "https://api.openaq.org/v3/locations/3409438/latest",
    headers=HEADERS
)
print("Status:", resp.status_code)
print(json.dumps(resp.json(), indent=2)[:2000])