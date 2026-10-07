"""Pin blueprint thresholds with high-precision decimal positive half-up rounding."""
from decimal import Decimal, localcontext, ROUND_HALF_UP
from pathlib import Path
import json
import sys

def derive(precision):
    with localcontext() as ctx:
        ctx.prec=precision
        ranks=[int((Decimal(100)*Decimal(level)**Decimal('1.35')).to_integral_value(rounding=ROUND_HALF_UP)) for level in range(1,100)]
        assets=[int((Decimal(40)*Decimal(level-1)**Decimal('1.65')).to_integral_value(rounding=ROUND_HALF_UP)) for level in range(1,101)]
    return {'policy':'progression.thresholds-v1','rankNext':ranks,'assetCumulative':assets}
a=derive(70)
assert a==derive(100)
for level,expected in [(1,0),(2,40),(10,1502),(25,7575),(45,20595),(70,43267),(100,78498)]:
    assert a['assetCumulative'][level-1]==expected
p=Path(__file__).resolve().parents[1]/'src/data/progression.json'
if '--write' in sys.argv:
    p.write_text(json.dumps(a,indent=2)+'\n')
else:
    assert json.loads(p.read_text())==a, 'Pinned table differs from the high-precision derivation'

print('Verified 99 rank costs and 100 asset thresholds; 70/100-digit derivations agree. Use --write, then npm run format, to regenerate.')
