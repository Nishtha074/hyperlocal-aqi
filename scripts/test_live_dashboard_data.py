import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.data.location import get_current_location
from src.data.live_aqi import get_live_aqi

location = get_current_location()

aqi = get_live_aqi(
    location["lat"],
    location["lon"]
)

print("City:", location["city"])
print("AQI:", aqi["aqi"])
print("PM2.5:", aqi["pm25"])
print("PM10:", aqi["pm10"])