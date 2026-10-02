#!/usr/bin/env python3
"""Check the actual asset catalog colors using WCAG relative luminance (stdlib only)."""
import json
from pathlib import Path

ASSETS = Path(__file__).resolve().parents[1] / 'Lakshly/Resources/Assets.xcassets'
TOKENS = ('bg', 'surface', 'gold', 'lotus', 'income', 'spend', 'invest', 'danger', 'success', 'secondaryText')

def colors(name):
    entries = json.loads((ASSETS / f'{name}.colorset/Contents.json').read_text())['colors']
    result = {}
    for entry in entries:
        mode = 'dark' if entry.get('appearances') else 'light'
        components = entry['color']['components']
        result[mode] = tuple(int(components[c], 16) / 255 for c in ('red', 'green', 'blue'))
    return result

def luminance(rgb):
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    return sum(v * weight for v, weight in zip(linear, (.2126, .7152, .0722)))

def contrast(a, b):
    hi, lo = sorted((luminance(a), luminance(b)), reverse=True)
    return (hi + .05) / (lo + .05)

if __name__ == '__main__':
    palette = {token: colors(token) for token in TOKENS}
    print('Token      Light hex  bg     surface  Dark hex   bg     surface  Result')
    failures = []
    for token, variants in palette.items():
        columns = []
        ratios = []
        for mode in ('light', 'dark'):
            rgb = variants[mode]
            hex_value = '#' + ''.join(f'{round(v * 255):02X}' for v in rgb)
            pair = [contrast(rgb, palette[base][mode]) for base in ('bg', 'surface')]
            ratios.extend(pair)
            columns.append(f'{hex_value}  {pair[0]:5.2f}  {pair[1]:7.2f}')
        target = 3 if token == 'lotus' else 4.5
        result = 'background' if token in ('bg', 'surface') else ('PASS' if min(ratios) >= target else 'FAIL')
        if result == 'FAIL':
            failures.append(token)
        print(f'{token:10} {"  ".join(columns)}  {result}')
    for mode in ('light', 'dark'):
        text = palette['secondaryText'][mode]
        surface = palette['surface'][mode]
        capsule = tuple(f * .14 + b * .86 for f, b in zip(text, surface))
        ratio = contrast(text, capsule)
        print(f'Demo capsule {mode}: {ratio:.2f}:1')
        if ratio < 4.5:
            failures.append(f'capsule {mode}')
        print(f'Disabled Submit {mode}: {contrast(text, surface):.2f}:1')
    assert colors('AccentColor') == palette['gold'], 'AccentColor must match gold'
    raise SystemExit(1 if failures else 0)
