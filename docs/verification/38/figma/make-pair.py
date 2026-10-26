from pathlib import Path
from PIL import Image

root = Path(__file__).parent
source = root.parents[1] / '27' / 'final.png'
app = Image.open(source).convert('RGB')
height = round(app.height * 393 / app.width)
app = app.resize((393, height), Image.Resampling.LANCZOS).crop((0, 0, 393, 852))
app.save(root / 'field-baseline-mac.png')
figma = Image.open(root / 'field-figma.png').convert('RGB')
assert figma.size == app.size == (393, 852)
pair = Image.new('RGB', (786, 852))
pair.paste(figma, (0, 0))
pair.paste(app, (393, 0))
pair.save(root / 'field-baseline-pair.png')
