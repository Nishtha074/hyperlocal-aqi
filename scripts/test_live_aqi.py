import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.data.live_aqi import get_live_aqi

result = get_live_aqi(
    lat=22.3072,
    lon=73.1812
)

print(result)