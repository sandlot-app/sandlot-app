"""Builds the Figma | Mac comparison pairs for ticket 38.

Run from the repository root after the Mac flow's screenshots are in ../screenshots:
    python3 docs/verification/38/figma/make-pairs.py

Each Mac capture is scaled to 393 points wide (the Figma frame's width) and cropped to 852 tall.
The simulator is an iPhone 17 Pro, 402 points wide, so the app half is scaled by 393/402.
"""
from pathlib import Path

from PIL import Image

here = Path(__file__).parent
for name in ['field', 'more']:
    figma = Image.open(here / f'{name}-figma.png').convert('RGB')
    mac = Image.open(here.parent / 'screenshots' / f'{name}.png').convert('RGB')
    mac = mac.resize((393, round(mac.height * 393 / mac.width)), Image.LANCZOS).crop((0, 0, 393, 852))
    mac.save(here / f'{name}-mac.png')
    pair = Image.new('RGB', (393 * 2 + 8, 852), 'white')
    pair.paste(figma, (0, 0))
    pair.paste(mac, (393 + 8, 0))
    pair.save(here / f'{name}-pair.png')
    print(name, figma.size, mac.size)
