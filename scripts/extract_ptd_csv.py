import pandas as pd
import re
import time
from collections import Counter

# Keywords for institutional owners
KEYWORDS = [
    "INVITATION HOMES", "INVH", "IH3", "IH4", "THR PROPERTY",
    "AMERICAN HOMES 4 RENT", "AMH", "AH4R",
    "TRICON", "PROGRESS RESIDENTIAL", "FIRSTKEY", "FIRST KEY",
    "BLACKROCK", "BLACK ROCK",
    "MAIN STREET RENEWAL", "AMHERST"
]

realty_advisors_rx = re.compile(r'%.*REALTY ADVISORS')
MAILING_FLAGS = ["75201", "85256", "94105"]

def check_match(row):
    # Combine relevant text from row for searching
    # Adjust column names based on actual header of 2021 PTD.csv
    # PTD usually has fields like owner_name, mailing_address_1
    row_str = " | ".join(str(s).upper() for s in row.values if pd.notnull(s))
    
    for kw in KEYWORDS:
        if kw in row_str:
            return f"Keyword: {kw}"
            
    if realty_advisors_rx.search(row_str):
        return "Keyword: % REALTY ADVISORS"
        
    for flag in MAILING_FLAGS:
        if flag in row_str:
            return f"Mailing: {flag}"
            
    return None

def process_file():
    start_time = time.time()
    input_file = "20210925_000416_PTD.csv"
    output_file = "institutional_owners_2021_PTD.csv"
    
    total_lines = 0
    matched_lines = 0
    counts = Counter()
    
    # Write header for output based on assumed relevant columns
    # Adjust these names based on actual CSV contents
    out_cols = ["Property_ID", "Owner_Name", "Mailing_Address", "Property_Address", "Match_Reason"]
    first_chunk = True
    
    # For large PTD CSV files, typical column indices or headers might need mapping.
    # Below is a generic fallback that treats the whole row as text for matching
    # then extracts a few likely columns if possible.
    chunksize = 10000
    for chunk in pd.read_csv(input_file, chunksize=chunksize, dtype=str, encoding='latin1'):
        total_lines += len(chunk)
        
        # Apply matching logic row by row
        matches = chunk.apply(check_match, axis=1)
        valid = matches.notnull()
        
        if valid.any():
            matched_chunk = chunk[valid].copy()
            matched_chunk["Match_Reason"] = matches[valid]
            
            # Count match categories
            for m in matches[valid]:
                counts[m] += 1
                
            # Attempt to map commonly known PTD abstract columns to our output
            # Assuming column 6 is property ID, 9 is prop addr, etc. (just an example based on TCAD standard)
            # You can adapt these explicitly to the real header.
            cols = list(chunk.columns)
            prop_id_col = cols[6] if len(cols) > 6 else cols[0]
            prop_addr_col = cols[9] if len(cols) > 9 else cols[0]
            
            # Since owner name and mailing aren't perfectly aligned in PTD without headers, 
            # we'll save the whole row for user review just in case, or best guess.
            # Here we just output the whole original chunk plus Match_Reason
            
            mode = 'w' if first_chunk else 'a'
            header = first_chunk
            matched_chunk.to_csv(output_file, mode=mode, header=header, index=False)
            first_chunk = False
            matched_lines += len(matched_chunk)
            
        print(f"Processed {total_lines} rows...", end="\r")
        
    elapsed = time.time() - start_time
    print(f"\nDone processing PTD CSV in {elapsed:.2f} seconds.")
    print(f"Total rows processed: {total_lines}")
    print(f"Matched institutional owners: {matched_lines}")
    print("\nMatches by Category:")
    for k, v in counts.most_common():
        print(f"  {k}: {v}")

if __name__ == "__main__":
    process_file()
