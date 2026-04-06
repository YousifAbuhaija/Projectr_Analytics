import pandas as pd
import re
import os
import time
from collections import Counter
import csv

# Layer A Keywords
KEYWORDS = [
    "INVITATION HOMES", "INVH LP", "THR PROPERTY", "STARWOOD WAYPOINT",
    "IH2 LP", "IH3 LP", "IH4 LP", "IH5 LP", "IH6 LP", "PREEMINENT HOLDINGS",
    "2017-1 IH BORROWER", "2018-1 IH BORROWER", "2018-2 IH BORROWER",
    "AMERICAN HOMES 4 RENT LP", "AH4R", "AMH 2014", "AMH 2015", "AMH TX PROPERTIES",
    "AMH ADDISON", "AMERICAN HOMES 4 RENT PROPERTIES", "AMERICAN HOMES 4 RENT TRS",
    "PROGRESS RESIDENTIAL BORROWER", "PROGRESS AUSTIN LLC",
    "TRICON RESIDENTIAL", "SFR JV-HD", "TRICON AMERICAN HOMES",
    "FIRSTKEY HOMES", "FIRST KEY HOMES",
    "MAIN STREET RENEWAL",
    "BLACKROCK REALTY ADVISORS", "BLACKROCK REAL ESTATE",
    "GUTHRIE PROPERTY OWNER"
]

# Layer B Zips
MAILING_ZIPS = ["75201", "85256", "91302", "91301", "89119"]

corp_ent_rx = re.compile(r'\b(LLC|L\.?P\.?|BORROWER)\b', re.IGNORECASE)

FILES = {
    "2021": "20210925_000416_PTD.csv",
    "2022": "227EARS092822.csv",
    "2023": "227EARS083023.csv",
    "2024": "227EARS082824.csv",
    "2025": "PROP.TXT"
}

def clean_str(s):
    return re.sub(r'\s+', ' ', s).strip()

def process_ptd(year, filename):
    out_file = f"institutional_owners_{year}.csv"
    if not os.path.exists(filename):
        print(f"Skipping {year}, file {filename} not found.")
        return None
        
    print(f"Processing {year} PTD data ({filename})...")
    chunksize = 10000
    first_chunk = True
    matched_lines = 0
    total_lines = 0
    
    # We will output standard columns, extracting best guess for ID, owner, address
    with open(out_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["Year", "Property_ID", "Owner_Info", "Match_Reason"])
    
    for chunk in pd.read_csv(filename, chunksize=chunksize, dtype=str, encoding='latin1', on_bad_lines='skip'):
        total_lines += len(chunk)
        outputs = []
        
        for _, row in chunk.iterrows():
            row_str = " | ".join(str(s).upper() for s in row.values if pd.notnull(s))
            
            match_reason = None
            # Layer A
            for kw in KEYWORDS:
                if kw in row_str:
                    match_reason = f"Keyword: {kw}"
                    break
                    
            # Layer B
            if not match_reason:
                for zip_code in MAILING_ZIPS:
                    # check if zip exists in row as standalone-ish
                    if zip_code in row_str and corp_ent_rx.search(row_str):
                        match_reason = f"Mailing: {zip_code} + Corp Entity"
                        break
            
            if match_reason:
                prop_id = row.values[6] if len(row.values) > 6 else ""
                owner_info = clean_str(row_str)  # Just dump row_str as owner info due to PTD structure
                outputs.append([year, prop_id, owner_info, match_reason])
                
        if outputs:
            matched_lines += len(outputs)
            with open(out_file, 'a', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerows(outputs)
                
        print(f"Processed {total_lines} rows for {year}...", end="\r")
    
    print(f"\nDone with {year}. Matched: {matched_lines}")
    return out_file

def process_prop_txt(year, filename):
    out_file = f"institutional_owners_{year}.csv"
    if not os.path.exists(filename):
        print(f"Skipping {year}, file {filename} not found.")
        return None
        
    print(f"Processing {year} PROP.TXT data ({filename})...")
    total_lines = 0
    matched_lines = 0
    
    with open(filename, 'r', encoding='latin1') as infile, \
         open(out_file, 'w', newline='', encoding='utf-8') as outfile:
         
        writer = csv.writer(outfile)
        writer.writerow(["Year", "Property_ID", "Owner_Info", "Match_Reason"])
        
        for line in infile:
            total_lines += 1
            line_upper = line.upper()
            
            match_reason = None
            for kw in KEYWORDS:
                if kw in line_upper:
                    match_reason = f"Keyword: {kw}"
                    break
                    
            if not match_reason:
                # check zip code anywhere
                for zip_code in MAILING_ZIPS:
                    if zip_code in line_upper and corp_ent_rx.search(line_upper):
                        match_reason = f"Mailing: {zip_code} + Corp Entity"
                        break
                        
            if match_reason:
                matched_lines += 1
                property_id = clean_str(line[0:30].replace("R", "").lstrip("0"))
                owner_info = clean_str(line[580:1000]) # Extract owner + address sections loosely
                writer.writerow([year, property_id, owner_info, match_reason])
                
    print(f"Done with {year}. Matched: {matched_lines}")
    return out_file

def main():
    generated_files = []
    
    for year, file in FILES.items():
        if file.endswith('.csv'):
            out = process_ptd(year, file)
        else:
            out = process_prop_txt(year, file)
            
        if out: generated_files.append(out)
        
    # Temporal Deduplication Step
    print("\nStarting Deduplication across years...")
    
    all_data = []
    for f in generated_files:
        df = pd.read_csv(f)
        all_data.append(df)
        
    master_df = pd.concat(all_data, ignore_index=True)
    
    # Sort so oldest is first
    master_df = master_df.sort_values(by="Year", ascending=True)
    
    deduped = []
    
    # Group by Property_ID
    for prop_id, group in master_df.groupby("Property_ID"):
        if not prop_id: continue
        
        prop_id_str = str(prop_id).strip()
        first_year = group["Year"].min()
        latest_row = group.iloc[-1]
        current_owner = latest_row["Owner_Info"]
        current_reason = latest_row["Match_Reason"]
        
        # Track historical ownership changes (if they belong to institution matches)
        historical = " -> ".join([f"[{r['Year']}] {r['Match_Reason']}" for _, r in group.iterrows()])
        
        deduped.append({
            "Property_ID": prop_id_str,
            "First_Year_Owned": first_year,
            "Current_Reason": current_reason,
            "Historical_Owners_Log": historical,
            "Latest_Owner_Info_Snippet": current_owner[:200]
        })
        
    deduped_df = pd.DataFrame(deduped)
    deduped_df.to_csv("institutional_properties_master.csv", index=False)
    
    print("\nPipeline Complete!")
    print(f"Total Unique Institutional Properties Found: {len(deduped_df)}")

if __name__ == "__main__":
    main()
