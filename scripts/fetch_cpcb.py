#!/usr/bin/env python3
"""Fetch CPCB snapshot from data.gov.in and append to a history CSV.

Usage:
  python scripts/fetch_cpcb.py --state Maharashtra --city Pune
  # or rely on .env / environment variables:
  DATA_GOV_API_KEY=... DATA_GOV_RESOURCE_ID=... python scripts/fetch_cpcb.py

The script reads API key and resource id from (in order):
 - CLI args --api-key / --resource-id
 - Environment variables DATA_GOV_API_KEY and DATA_GOV_RESOURCE_ID
 - A .env file (requires python-dotenv; optional)

Output:
 - Appends rows to `data/raw/cpcb/<city>_cpcb_history.csv`

Exit codes:
 - 0 success (may be no new rows)
 - 1 error
"""
import argparse
import os
import sys
import logging
from datetime import datetime

try:
    import requests
    import pandas as pd
except Exception as e:
    print('Missing dependency:', e)
    print('Run: pip install requests pandas python-dotenv')
    sys.exit(1)

# Try to load .env if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')

DEFAULT_LIMIT = 1000


def get_env_or_arg(cli_value, env_name):
    if cli_value:
        return cli_value
    val = os.environ.get(env_name)
    return val


def fetch_records(api_key, resource_id, state, city, limit=DEFAULT_LIMIT, timeout=30):
    url = f'https://api.data.gov.in/resource/{resource_id}'
    params = {
        'api-key': api_key,
        'format': 'json',
        'filters[state]': state,
        'filters[city]': city,
        'limit': limit,
    }
    logging.info('Requesting CPCB data: %s %s %s', state, city, url)
    resp = requests.get(url, params=params, timeout=timeout)
    resp.raise_for_status()
    payload = resp.json()
    records = payload.get('records', [])
    return records


def append_to_csv(records, out_file):
    if not records:
        logging.info('No records to append.')
        return 0
    df = pd.DataFrame(records)
    df['fetched_at_utc'] = datetime.utcnow().isoformat()
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    header = not os.path.exists(out_file)
    df.to_csv(out_file, mode='a', header=header, index=False)
    logging.info('Appended %d rows to %s', len(df), out_file)
    return len(df)


def main():
    p = argparse.ArgumentParser(description='Fetch CPCB snapshot and append to CSV')
    p.add_argument('--api-key', help='data.gov.in API key')
    p.add_argument('--resource-id', help='data.gov.in resource id')
    p.add_argument('--state', default=os.environ.get('CPCB_STATE', 'Maharashtra'))
    p.add_argument('--city', default=os.environ.get('CPCB_CITY', 'Pune'))
    p.add_argument('--limit', type=int, default=DEFAULT_LIMIT)
    p.add_argument('--out-file', help='Output CSV file path')

    args = p.parse_args()

    api_key = get_env_or_arg(args.api_key, 'DATA_GOV_API_KEY')
    resource_id = get_env_or_arg(args.resource_id, 'DATA_GOV_RESOURCE_ID')

    if not api_key or not resource_id:
        logging.error('API key and resource id required. Provide via args, env vars, or .env.\nExample .env:\nDATA_GOV_API_KEY=your_key\nDATA_GOV_RESOURCE_ID=3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69')
        sys.exit(1)

    state = args.state
    city = args.city
    limit = args.limit

    out_file = args.out_file or os.path.join('data', 'raw', 'cpcb', f"{city.lower().replace(' ', '_')}_cpcb_history.csv")

    try:
        records = fetch_records(api_key, resource_id, state, city, limit=limit)
    except Exception as e:
        logging.exception('Failed to fetch records: %s', e)
        sys.exit(1)

    try:
        n = append_to_csv(records, out_file)
        logging.info('Done. %d rows written.', n)
    except Exception as e:
        logging.exception('Failed to write CSV: %s', e)
        sys.exit(1)


if __name__ == '__main__':
    main()
