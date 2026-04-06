"""
Cleanup script for institutional ownership data.

Fixes three problems:
1. False positives from overly broad keywords (bare "AMH", "AMHERST", "IH3"/"IH4" matching highways)
2. Personal property records mixed in with real property (EARS data)
3. Duplicate rows per property per year (EARS data has one row per taxing jurisdiction)

Reads the processed CSVs, applies cleanup rules, writes cleaned versions,
and rebuilds the master file.
"""

import pandas as pd
import re
import os

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'processed_owners')

# --- False positive patterns to remove ---

# These Match_Reasons are from the bare "AMH" and "AMHERST" keywords which
# catch street names (Amherst Dr), personal names (ADHAMH), and unrelated entities.
# The REAL AMH corporate entities match on more specific keywords like
# "AMH 2014", "AMH ADDISON", "AH4R", "AMERICAN HOMES 4 RENT", etc.
FALSE_POSITIVE_REASONS = {
    "Keyword: AMH",
    "Keyword: AMHERST",
}

# IH3/IH4 keywords match Interstate Highway 35 (IH35) addresses
IH_HIGHWAY_PATTERN = re.compile(r'IH\s*35|IH-35|INTERSTATE', re.IGNORECASE)

# For zip-code-based matches, require the owner to look corporate (not an individual person)
CORPORATE_PATTERN = re.compile(r'\b(LLC|L\.?L\.?C|L\.?P\.?|LP|BORROWER|INC|CORP|TRUST|HOLDINGS|PROPERTIES|PARTNERS|VENTURE|FUND)\b', re.IGNORECASE)

# Known non-institutional entities that slip through zip code matching
NON_INSTITUTIONAL = [
    "WELLS FARGO",
    "7-ELEVEN",
    "7 ELEVEN",
    "BAPTIST CHURCH",
    "MISSIONARY",
]

# For zip matching: these zips must appear as actual mailing zip, not as a
# substring of a longer number. We check for the pattern: state abbrev + space + zip
ZIP_VERIFY = {
    "75201": re.compile(r'\bTX\s+75201\b'),
    "85256": re.compile(r'\bAZ\s+85256\b'),
    "91302": re.compile(r'\bCA\s+91302\b'),
    "91301": re.compile(r'\bCA\s+91301\b'),
    "89119": re.compile(r'\bNV\s+89119\b'),
    "94105": re.compile(r'\bCA\s+94105\b'),
}


def is_false_positive(row):
    """Returns True if this row should be removed."""
    reason = str(row.get('Match_Reason', ''))

    # Check column that contains the full text — differs between PROP and EARS formats
    # PROP format has Owner_Name, Mailing_Address, Property_Address
    # EARS format has Owner_Info
    full_text = ''
    if 'Owner_Info' in row.index:
        full_text = str(row['Owner_Info'])
    else:
        full_text = f"{row.get('Owner_Name', '')} {row.get('Mailing_Address', '')} {row.get('Property_Address', '')}"

    full_upper = full_text.upper()

    # 1. Remove bare AMH / AMHERST keyword matches
    if reason in FALSE_POSITIVE_REASONS:
        return True

    # 2. Remove IH3/IH4 matches that are actually IH-35 highway references or unrelated
    if reason in ("Keyword: IH3", "Keyword: IH4"):
        # Only keep if the owner name itself contains the IH3/IH4 pattern as a corporate entity
        owner_text = str(row.get('Owner_Name', row.get('Owner_Info', ''))).upper()
        if 'IH3 ' not in owner_text and 'IH4 ' not in owner_text and 'IH3 LP' not in owner_text and 'IH4 LP' not in owner_text:
            return True

    # 3. Remove personal property records (EARS data)
    if 'PERSONAL PROPERTY' in full_upper:
        return True

    # 4. For zip-code-based matches, verify the zip is real and owner is corporate
    if reason.startswith('Mailing:'):
        # Extract the zip from the reason
        zip_in_reason = reason.split(':')[1].strip().split()[0]

        # Verify the zip actually appears as a real mailing zip, not a substring
        if zip_in_reason in ZIP_VERIFY:
            if not ZIP_VERIFY[zip_in_reason].search(full_text):
                return True

        # Require the owner to look like a corporate entity, not an individual
        owner_text = str(row.get('Owner_Name', row.get('Owner_Info', '')))
        if not CORPORATE_PATTERN.search(owner_text):
            return True

    # 5. Remove known non-institutional entities
    for name in NON_INSTITUTIONAL:
        if name in full_upper:
            return True

    # 6. "BLACK ROCK" (with space) is always a false positive — catches coffee shops,
    # vape stores, and street names. Real BlackRock entities use "BLACKROCK" (one word)
    # or match via "BLACKROCK REALTY ADVISORS" / "GUTHRIE PROPERTY OWNER".
    if reason == "Keyword: BLACK ROCK":
        return True

    return False


def clean_file(filepath):
    """Clean a single processed CSV file. Returns cleaned DataFrame."""
    df = pd.read_csv(filepath, dtype=str)
    original_count = len(df)

    # Apply false positive filter
    mask = df.apply(is_false_positive, axis=1)
    df_clean = df[~mask].copy()

    # Deduplicate by Property_ID within the file
    id_col = 'Property_ID'
    if id_col in df_clean.columns:
        before_dedup = len(df_clean)
        df_clean = df_clean.drop_duplicates(subset=[id_col], keep='first')
        dupes_removed = before_dedup - len(df_clean)
    else:
        dupes_removed = 0

    removed = original_count - len(df_clean)
    false_pos = removed - dupes_removed

    return df_clean, original_count, false_pos, dupes_removed


def rebuild_master(cleaned_files):
    """Rebuild the master file from all cleaned per-year files."""
    all_data = []
    for filepath, df in cleaned_files:
        all_data.append(df)

    if not all_data:
        print("No data to merge!")
        return

    master = pd.concat(all_data, ignore_index=True)

    # Sort by year
    if 'Year' in master.columns:
        master = master.sort_values('Year')

    # Deduplicate across years by Property_ID, keeping earliest year
    if 'Property_ID' in master.columns:
        master_deduped = []
        for prop_id, group in master.groupby('Property_ID'):
            if not prop_id or str(prop_id).strip() == '':
                continue
            first_year = group['Year'].min() if 'Year' in group.columns else 'N/A'
            latest = group.iloc[-1]

            owner_info = latest.get('Owner_Info', latest.get('Owner_Name', ''))
            reason = latest.get('Match_Reason', latest.get('Current_Reason', ''))

            master_deduped.append({
                'Property_ID': str(prop_id).strip(),
                'First_Year_Institutional': first_year,
                'Latest_Match_Reason': reason,
                'Latest_Owner': str(owner_info)[:200],
                'Years_Present': ' -> '.join(sorted(str(y) for y in group['Year'].unique())) if 'Year' in group.columns else 'N/A',
            })

        master_df = pd.DataFrame(master_deduped)
    else:
        master_df = master.drop_duplicates(subset=['Property_ID'], keep='first')

    master_path = os.path.join(PROCESSED_DIR, 'institutional_properties_master.csv')
    master_df.to_csv(master_path, index=False)
    print(f"\nMaster file: {len(master_df)} unique properties -> {master_path}")
    return master_df


def main():
    print("=" * 60)
    print("INSTITUTIONAL OWNERSHIP DATA CLEANUP")
    print("=" * 60)

    # Files to clean (per-year CSVs)
    files_to_clean = [
        ('2021 EARS', 'institutional_owners_2021.csv'),
        ('2022 EARS', 'institutional_owners_2022.csv'),
        ('2023 EARS', 'institutional_owners_2023.csv'),
        ('2024 EARS', 'institutional_owners_2024.csv'),
        ('2025 EARS', 'institutional_owners_2025.csv'),
        ('2025 PROP', 'institutional_owners_2025_PROP.csv'),
    ]

    # Also clean the earlier 2021 PTD extraction if it exists
    ptd_file = os.path.join(PROCESSED_DIR, 'institutional_owners_2021_PTD.csv')
    if os.path.exists(ptd_file):
        files_to_clean.insert(0, ('2021 PTD', 'institutional_owners_2021_PTD.csv'))

    cleaned_results = []

    for label, filename in files_to_clean:
        filepath = os.path.join(PROCESSED_DIR, filename)
        if not os.path.exists(filepath):
            print(f"\n[SKIP] {label}: {filename} not found")
            continue

        df_clean, original, false_pos, dupes = clean_file(filepath)

        # Write cleaned version
        clean_path = filepath.replace('.csv', '_clean.csv')
        df_clean.to_csv(clean_path, index=False)

        print(f"\n[{label}]")
        print(f"  Original:         {original} rows")
        print(f"  False positives:  {false_pos} removed")
        print(f"  Duplicates:       {dupes} removed")
        print(f"  Clean:            {len(df_clean)} rows -> {os.path.basename(clean_path)}")

        cleaned_results.append((clean_path, df_clean))

    # Rebuild master from cleaned files
    # Use the EARS files (which have Year column) for temporal tracking
    # and the PROP file for 2025 snapshot
    print("\n" + "=" * 60)
    print("REBUILDING MASTER FILE")
    print("=" * 60)

    master_df = rebuild_master(cleaned_results)

    if master_df is not None:
        # Print summary by match reason
        print("\nProperties by match type:")
        for reason, count in master_df['Latest_Match_Reason'].value_counts().items():
            print(f"  {reason}: {count}")

        # Print summary by first year
        if 'First_Year_Institutional' in master_df.columns:
            print("\nProperties by first year identified:")
            for year, count in master_df['First_Year_Institutional'].value_counts().sort_index().items():
                print(f"  {year}: {count}")


if __name__ == '__main__':
    main()
