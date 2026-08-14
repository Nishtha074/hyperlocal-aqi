import time
import subprocess

print("Starting auto-collector (CPCB + Weather + OpenAQ). Leave this window open.")
print("Collects data every hour, right now, and repeats.")

while True:
    print("\n--- Collecting CPCB air quality data ---")
    subprocess.run(["python", "scripts/collect_cpcb.py"])

    print("\n--- Collecting weather data ---")
    subprocess.run(["python", "scripts/collect_weather.py"])

    print("\n--- Collecting OpenAQ backup data ---")
    subprocess.run(["python", "scripts/fetch_openaq.py"])

    print("\nDone. Waiting 1 hour before next collection...")
    time.sleep(3600)