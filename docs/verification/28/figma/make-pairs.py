from pathlib import Path
import hashlib
import json
from PIL import Image

here = Path(__file__).resolve().parent
captures = here.parent / 'diagnostic-capture' / 'screenshots'
mapping = [
    ('setup', '167:11241', 'setup-reference-state'),
    ('lineup', '168:11244', 'lineup-before-reorder'),
    ('plays', '69:1895', 'ordered-saved-play-log'),
    ('games', '107:5105', 'games-before-setup'),
    ('field', '165:11107', 'field-before-play-draft'),
    ('in-play-1-outcome', '75:2900', 'inplay-step-1-outcome'),
    ('in-play-2-fielder', '75:3162', 'inplay-step-2-fielder'),
    ('in-play-3-runners', '75:3487', 'inplay-step-3-runners'),
    ('steal-attempt', '87:2869', 'runner-sheet-selected-game'),
    ('more', '165:11367', 'more-before-runner-sheet'),
]
rows = []
for name, node, capture in mapping:
    reference = here / f'{name}-figma-full.png'
    row = {'screen': name, 'node': node, 'capture': capture,
           'app_source': 'b0e74e12942efb66d4332186742cd67e237a45a8'}
    source = captures / f'{capture}.png'
    if not source.exists():
        row['result'] = 'Mac capture missing; pair incomplete'
        rows.append(row)
        continue
    original = Image.open(source)
    if original.size not in [(1178, 2556), (1179, 2556)]:
        raise ValueError(f'Unexpected native geometry {original.size} for {source}')
    app = original.resize((393, 852), Image.Resampling.LANCZOS).convert('RGB')
    design = Image.open(reference).convert('RGB')
    row['figma_original_size'] = list(design.size)
    row['native_original_size'] = list(original.size)
    row['native_sha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
    row['figma_sha256'] = hashlib.sha256(reference.read_bytes()).hexdigest()
    row['reference_crop'] = [0, 0, 393, 852]
    row['result'] = 'Comparison evidence only; Figma gate is blocked'
    design = design.crop((0, 0, 393, 852))
    app.save(here / f'{name}-mac.png')
    design.save(here / f'{name}-figma.png')
    pair = Image.new('RGB', (786, 852), 'white')
    pair.paste(design, (0, 0))
    pair.paste(app, (393, 0))
    pair.save(here / f'{name}-pair.png')
    rows.append(row)
(here / 'pairs.json').write_text(json.dumps(rows, indent=2) + '\n')
print(json.dumps({'pairs': sum('native_sha256' in row for row in rows),
                  'missing': [row['screen'] for row in rows if 'native_sha256' not in row]}))
