import hashlib
import os
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, Tuple

import pandas as pd
from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

CANONICAL_NAME_MAP = {
    "DOCTOR XHAKZA": "DOCTOR XHAKAZA",
    "Jean sethato": "Jean Sethato",
    "Nomadlozi nkosi": "Nomadlozi Nkosi",
    "jongizizwe Dlabathi": "Jongizwe Dlabathi",
}

WARD_PATTERN = re.compile(r"WARD\s*(\d+)", re.IGNORECASE)


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def canonicalize_name(raw_name: str) -> str:
    cleaned = normalize_whitespace(raw_name)
    if not cleaned:
        return ""

    for alias, canonical in CANONICAL_NAME_MAP.items():
        if cleaned.lower() == alias.lower():
            return canonical

    # Preserve all-caps tokens while still normalizing mixed case names.
    if cleaned.isupper():
        return cleaned
    return " ".join(part.capitalize() for part in cleaned.split(" "))


def parse_branch_nomi(filepath: Path) -> Tuple[Dict[Tuple[str, int, str], int], Dict[str, str]]:
    sheet = pd.read_excel(filepath, sheet_name="BRANCH NOMI", header=None, dtype=str)
    sheet = sheet.fillna("")

    header_row_index = 2
    if len(sheet) < header_row_index + 1:
        raise ValueError("BRANCH NOMI sheet appears incomplete.")

    zone_row = [normalize_whitespace(str(value)) for value in sheet.iloc[header_row_index].tolist()]
    nomination_counts: Dict[Tuple[str, int, str], int] = defaultdict(int)
    alias_tracker: Dict[str, str] = {}

    for col_idx, zone_label in enumerate(zone_row):
        if not zone_label or zone_label.lower().startswith("column"):
            continue

        current_ward = None
        for row_idx in range(header_row_index + 1, len(sheet)):
            raw_value = normalize_whitespace(str(sheet.iat[row_idx, col_idx]))
            if not raw_value:
                continue

            ward_match = WARD_PATTERN.search(raw_value)
            if ward_match:
                current_ward = int(ward_match.group(1))
                continue

            if current_ward is None:
                continue

            if raw_value.upper().startswith("WARD"):
                continue

            canonical_name = canonicalize_name(raw_value)
            if not canonical_name:
                continue

            if canonical_name.lower() != normalize_whitespace(raw_value).lower():
                alias_tracker[raw_value] = canonical_name

            nomination_counts[(zone_label, current_ward, canonical_name)] += 1

    return dict(nomination_counts), alias_tracker


def normalize_cell_value(value: object):
    if value is None:
        return None

    if isinstance(value, str):
        cleaned = normalize_whitespace(value)
        return cleaned or None

    if pd.isna(value):
        return None

    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            return value

    return value


def trim_trailing_empty_cells(row: list[object]) -> list[object]:
    trimmed = list(row)
    while trimmed and trimmed[-1] is None:
        trimmed.pop()
    return trimmed


def extract_workbook_sheet_rows(filepath: Path) -> list[dict]:
    workbook = pd.read_excel(filepath, sheet_name=None, header=None)
    sheet_rows: list[dict] = []

    for sheet_name, frame in workbook.items():
        normalized_frame = frame.where(pd.notna(frame), None)
        for row_index, row in enumerate(normalized_frame.itertuples(index=False, name=None), start=1):
            row_data = trim_trailing_empty_cells([normalize_cell_value(value) for value in row])
            if not row_data:
                continue

            sheet_rows.append(
                {
                    "sheet_name": sheet_name,
                    "row_index": row_index,
                    "row_data": row_data,
                }
            )

    return sheet_rows


def file_checksum(filepath: Path) -> str:
    sha = hashlib.sha256()
    with filepath.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha.update(chunk)
    return sha.hexdigest()


def single_id(client: Client, table: str, field: str, value: object):
    result = client.table(table).select("id").eq(field, value).limit(1).execute()
    rows = result.data or []
    if not rows:
        raise ValueError(f"No row found in '{table}' for {field}={value}")
    return rows[0]["id"]


def upsert_rows(client: Client, table: str, rows: Iterable[dict], on_conflict: str) -> None:
    data = list(rows)
    if not data:
        return
    client.table(table).upsert(data, on_conflict=on_conflict).execute()


def clean_and_seed() -> None:
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY is required in environment variables.")

    filepath_value = os.environ.get("SEED_FILE_PATH")
    if not filepath_value:
        raise ValueError("SEED_FILE_PATH environment variable not set in .env")

    filepath = Path(filepath_value).resolve()
    if not filepath.exists():
        raise FileNotFoundError(f"Seed workbook not found: {filepath}")

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    checksum = file_checksum(filepath)

    batch_insert = supabase.table("ingestion_batches").insert(
        {
            "source_filename": filepath.name,
            "source_checksum": checksum,
            "status": "PENDING",
        }
    ).execute()
    batch_id = batch_insert.data[0]["id"]

    try:
        nomination_counts, aliases = parse_branch_nomi(filepath)
        workbook_sheet_rows = extract_workbook_sheet_rows(filepath)

        upsert_rows(
            supabase,
            "workbook_sheet_rows",
            (
                {
                    "batch_id": batch_id,
                    "sheet_name": row["sheet_name"],
                    "row_index": row["row_index"],
                    "row_data": row["row_data"],
                }
                for row in workbook_sheet_rows
            ),
            on_conflict="batch_id,sheet_name,row_index",
        )

        zone_names = sorted({zone for zone, _, _ in nomination_counts.keys()})
        upsert_rows(
            supabase,
            "zones",
            ({"name": zone_name, "coordinator_name": zone_name.title()} for zone_name in zone_names),
            on_conflict="name",
        )

        wards = sorted({(ward_number, zone_name) for zone_name, ward_number, _ in nomination_counts.keys()})
        ward_rows = []
        for ward_number, zone_name in wards:
            zone_id = single_id(supabase, "zones", "name", zone_name)
            ward_rows.append({"ward_number": ward_number, "zone_id": zone_id})
        upsert_rows(supabase, "wards", ward_rows, on_conflict="ward_number")

        candidate_names = sorted({candidate_name for _, _, candidate_name in nomination_counts.keys()})
        upsert_rows(
            supabase,
            "candidates",
            ({"full_name": candidate_name, "is_active": True} for candidate_name in candidate_names),
            on_conflict="full_name",
        )

        alias_rows = []
        for alias_name, canonical_name in aliases.items():
            candidate_id = single_id(supabase, "candidates", "full_name", canonical_name)
            alias_rows.append(
                {
                    "candidate_id": candidate_id,
                    "alias_name": alias_name,
                    "source_note": "Parsed from workbook variant",
                }
            )
        upsert_rows(supabase, "candidate_aliases", alias_rows, on_conflict="alias_name")

        nomination_rows = []
        for (zone_name, ward_number, candidate_name), vote_count in nomination_counts.items():
            ward_id = single_id(supabase, "wards", "ward_number", ward_number)
            candidate_id = single_id(supabase, "candidates", "full_name", candidate_name)
            nomination_rows.append(
                {
                    "ward_id": ward_id,
                    "candidate_id": candidate_id,
                    "vote_count": vote_count,
                    "batch_id": batch_id,
                }
            )
        upsert_rows(supabase, "nominations", nomination_rows, on_conflict="ward_id,candidate_id")

        supabase.table("ingestion_batches").update(
            {
                "status": "SUCCESS",
                "error_summary": None,
            }
        ).eq("id", batch_id).execute()

        print(f"Database seeding completed successfully. Batch: {batch_id}")
        print(f"Transferred workbook rows: {len(workbook_sheet_rows)}")
        print(f"Processed nominations: {len(nomination_rows)}")
    except Exception as error:
        supabase.table("ingestion_batches").update(
            {
                "status": "FAILED",
                "error_summary": str(error),
            }
        ).eq("id", batch_id).execute()
        raise


if __name__ == "__main__":
    clean_and_seed()
