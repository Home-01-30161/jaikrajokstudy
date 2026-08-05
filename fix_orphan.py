import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('client/src/App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Lines 1297-1310 (0-indexed: 1296-1309) are the orphaned block
# The block after line 1295 (setCurrentView) and before line 1311 (</>)
# We want to keep line 1296 (}}) and line 1311 (/>) but remove 1297-1310

# 0-indexed: keep up to and including index 1295 (line 1296), 
# then skip 1296-1309 (lines 1297-1310), then keep from 1310 onwards (line 1311 />)
before = lines[:1296]   # lines 1 to 1296
after = lines[1310:]    # lines 1311 onwards

new_lines = before + after

with open('client/src/App.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f'Done. Removed {1310 - 1296} lines. New total: {len(new_lines)}')
# Verify
with open('client/src/App.tsx', 'r', encoding='utf-8') as f:
    lines2 = f.readlines()
for i, l in enumerate(lines2[1292:1302], 1293):
    print(f'{i}: {l}', end='')
