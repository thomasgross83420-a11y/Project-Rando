"""Pinned 65536-heading fixed-point sine/cosine table, 0 north clockwise.
Offline generator only: platform trigonometry never executes in simulation.
"""
import math,json,hashlib
from pathlib import Path
p=Path(__file__).resolve().parents[3]/'src/data/heading.json'
a=[[round(math.sin(i*math.tau/65536)*1048576),round(-math.cos(i*math.tau/65536)*1048576)] for i in range(65536)]
p.write_text(json.dumps(a,separators=(',',':'))+'\n')
print('Pinned headings',len(a),hashlib.sha256(p.read_bytes()).hexdigest())
