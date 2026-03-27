import os, sys

f = os.path.join('src', 'components', 'ConsultarRegistros.tsx')
with open(f, 'rb') as fh:
    data = fh.read()

# Search for 'alumno_id' near line 586
idx = data.find(b'alumno_id)')
while idx != -1:
    context = data[max(0,idx-30):idx+50]
    print(f"Found at byte {idx}: {context!r}", flush=True)
    idx = data.find(b'alumno_id)', idx+1)

# Also show bytes around position
print(f"\nFile size: {len(data)}", flush=True)
print(f"First 10 bytes hex: {data[:10].hex()}", flush=True)
