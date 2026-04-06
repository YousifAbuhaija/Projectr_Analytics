import csv
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

# Regex for '% followed by REALTY ADVISORS'
realty_advisors_rx = re.compile(r'%.*REALTY ADVISORS')

# Mailing flag zip codes or cities
MAILING_FLAGS = ["75201", "85256", "94105"]

# Track match counts
counts = Counter()

def clean_str(s):
    return re.sub(r'\s+', ' ', s).strip()

def process_file():
    start_time = time.time()
    input_file = "PROP.TXT"
    output_file = "institutional_owners_2025_PROP.csv"
    
    total_lines = 0
    matched_lines = 0
    
    with open(input_file, 'r', encoding='latin1') as infile, \
         open(output_file, 'w', newline='', encoding='utf-8') as outfile:
         
        writer = csv.writer(outfile)
        writer.writerow(["Property_ID", "Owner_Name", "Mailing_Address", "Property_Address", "Match_Reason"])
        
        for line in infile:
            total_lines += 1
            line_upper = line.upper()
            
            match_reason = None
            
            # 1. Search for keywords
            for kw in KEYWORDS:
                if kw in line_upper:
                    match_reason = f"Keyword: {kw}"
                    counts[kw] += 1
                    break
            
            if not match_reason and realty_advisors_rx.search(line_upper):
                match_reason = "Keyword: % REALTY ADVISORS"
                counts["% REALTY ADVISORS"] += 1
                
            # 2. Check mailing flags (either literal or simply checking if the text from address area matches)
            # Since address area is roughly from 693 to 985
            # We'll just check if the strings are in the line
            if not match_reason:
                for flag in MAILING_FLAGS:
                    # Limit the search to the address section to prevent false positives in property address or names
                    # approx index 690 to 1000
                    addr_chunk = line_upper[min(len(line_upper), 690):min(len(line_upper), 1000)]
                    if flag in addr_chunk:
                        match_reason = f"Mailing: {flag}"
                        counts[f"Mailing: {flag}"] += 1
                        break
                        
            if match_reason:
                matched_lines += 1
                # Extract fields using approximate positions
                property_id = line[0:30].replace("R", "").strip().lstrip("0")
                if not property_id: property_id = line[0:30].strip()
                
                # Owner string typically around 590 to 690, we remove leading numbers
                raw_owner = line[580:693].strip()
                owner_name = clean_str(raw_owner.lstrip("0123456789"))
                
                mail_addr1 = line[693:753]
                mail_addr2 = line[753:873]
                city = line[873:923]
                state = line[923:978]
                zipcode = line[978:990]
                mailing_address = clean_str(f"{mail_addr1} {mail_addr2} {city} {state} {zipcode}")
                
                # Property address around 1000 onwards
                prop_address = clean_str(line[1010:1100])
                
                writer.writerow([property_id, owner_name, mailing_address, prop_address, match_reason])
                
    elapsed = time.time() - start_time
    print(f"Done processing PROP.TXT in {elapsed:.2f} seconds.")
    print(f"Total lines processed: {total_lines}")
    print(f"Matched institutional owners: {matched_lines}")
    print("\nMatches by Category:")
    for k, v in counts.most_common():
        print(f"  {k}: {v}")

if __name__ == "__main__":
    process_file()
