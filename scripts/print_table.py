#!/usr/bin/env python3
"""
Simple Python script to fetch and print the first N values of a table.
Designed for daily cron execution in GitHub Actions or local CLI usage.
"""

import argparse
import os
import sys
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from tabulate import tabulate

# Load environment variables from .env if present
load_dotenv()


def get_demo_data(limit: int = 5):
    """Fallback sample data to display if the table is empty or database is not configured."""
    return [
        {
            "id": 1,
            "order_reference": "CMD-2026-001",
            "customer_name": "Sophie Martin",
            "article_name": "Robe Bohème Fleurie",
            "amount": 29.99,
            "status": "paid",
            "created_at": "2026-10-17 14:22:00",
        },
        {
            "id": 2,
            "order_reference": "CMD-2026-002",
            "customer_name": "Lucas Dubois",
            "article_name": "Veste en Jean Vintage",
            "amount": 45.00,
            "status": "paid",
            "created_at": "2026-10-17 16:05:12",
        },
        {
            "id": 3,
            "order_reference": "CMD-2026-003",
            "customer_name": "Emma Bernard",
            "article_name": "Pull Maille Oversize",
            "amount": 34.50,
            "status": "unpaid",
            "created_at": "2026-10-18 09:14:33",
        },
        {
            "id": 4,
            "order_reference": "CMD-2026-004",
            "customer_name": "Thomas Petit",
            "article_name": "Ensemble Tailleur Noir",
            "amount": 59.90,
            "status": "paid",
            "created_at": "2026-10-18 11:45:09",
        },
        {
            "id": 5,
            "order_reference": "CMD-2026-005",
            "customer_name": "Chloé Robert",
            "article_name": "Chemise Satinée Dorée",
            "amount": 25.00,
            "status": "paid",
            "created_at": "2026-10-18 13:30:45",
        },
    ][:limit]


def fetch_supabase_table(url: str, key: str, table: str, limit: int = 5):
    """Query first N records from Supabase REST API."""
    endpoint = f"{url.rstrip('/')}/rest/v1/{table}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    params = {
        "select": "*",
        "limit": limit,
    }
    response = requests.get(endpoint, headers=headers, params=params, timeout=15)
    response.raise_for_status()
    return response.json()


def clean_row_for_display(row: dict) -> dict:
    """Format dictionary values to fit nicely in a terminal table."""
    cleaned = {}
    for k, v in row.items():
        if isinstance(v, dict) or isinstance(v, list):
            val_str = str(v)
            cleaned[k] = (val_str[:25] + "...") if len(val_str) > 25 else val_str
        elif isinstance(v, str) and len(v) > 30:
            cleaned[k] = v[:27] + "..."
        else:
            cleaned[k] = v
    return cleaned


def main():
    parser = argparse.ArgumentParser(description="Print the first N rows of a table.")
    parser.add_argument("--table", default=os.getenv("TABLE_NAME", "payments"), help="Name of table to query")
    parser.add_argument("--limit", type=int, default=int(os.getenv("ROW_LIMIT", "5")), help="Number of rows to fetch")
    args = parser.parse_args()

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_PUBLISHABLE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
    )

    utc_now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    print("=" * 80)
    print(f"📊 CRON JOB - TABLE PREVIEW: {args.table.upper()} (First {args.limit} rows)")
    print(f"🕒 Executed at: {utc_now}")
    print("=" * 80)

    rows = []
    source = "demo"

    if supabase_url and supabase_key:
        try:
            print(f"🔗 Querying Supabase table: '{args.table}'...")
            data = fetch_supabase_table(supabase_url, supabase_key, args.table, args.limit)
            if data:
                rows = data
                source = "supabase"
                print(f"✅ Successfully retrieved {len(rows)} record(s) from Supabase.\n")
            else:
                print(f"ℹ️ Table '{args.table}' exists in Supabase but currently has 0 rows.")
                print("Showing sample preview of 5 rows below:\n")
                rows = get_demo_data(args.limit)
        except Exception as e:
            print(f"⚠️ Could not fetch from Supabase ({e}). Falling back to sample demonstration rows:\n")
            rows = get_demo_data(args.limit)
    else:
        print("ℹ️ No Supabase credentials detected (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY).")
        print("Displaying sample demonstration table:\n")
        rows = get_demo_data(args.limit)

    if not rows:
        print("No data available to display.")
        return

    # Clean row values for display
    display_rows = [clean_row_for_display(r) for r in rows]

    # Print formatted table
    table_output = tabulate(display_rows, headers="keys", tablefmt="grid")
    print(table_output)
    print("\n" + "=" * 80)
    print(f"Total rows displayed: {len(rows)} (Source: {source.capitalize()})")
    print("=" * 80)


if __name__ == "__main__":
    main()
