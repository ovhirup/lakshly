#!/usr/bin/env python3
"""Check theme WCAG contrast and CIE76 category distances (stdlib only).

Every category must meet WCAG 1.4.11's >=3:1 against its card surface.
Monochrome Gold: all nine key categories >=10, groceries/emi >=25.
Other themes: all nine key categories >=15, groceries/emi >=25.
Checking all pairs also covers every possible adjacent demo donut slice.
"""
import itertools
import json
import math
from pathlib import Path

THEMES = Path(__file__).resolve().parents[3] / 'docs/themes.json'
TEXT_TOKENS = ('gold', 'income', 'spend', 'invest', 'danger', 'success', 'text', 'secondaryText')
TOP = ('groceries', 'rent', 'dining', 'emi', 'investments', 'health', 'shopping', 'transport', 'utilities')

def rgb(value):
    if len(value) != 7 or value[0] != '#':
        raise ValueError(f'Expected #RRGGBB: {value}')
    return tuple(int(value[i:i+2], 16) / 255 for i in (1, 3, 5))

def linear(rgb):
    return [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]

def luminance(rgb):
    return sum(v * w for v, w in zip(linear(rgb), (.2126, .7152, .0722)))

def contrast(a, b):
    hi, lo = sorted((luminance(a), luminance(b)), reverse=True)
    return (hi + .05) / (lo + .05)

def lab(value):
    r, g, b = linear(rgb(value))
    xyz = ((.4124564*r+.3575761*g+.1804375*b)/.95047,
           .2126729*r+.7151522*g+.0721750*b,
           (.0193339*r+.1191920*g+.9503041*b)/1.08883)
    x, y, z = [v ** (1/3) if v > (6/29)**3 else v/(3*(6/29)**2)+4/29 for v in xyz]
    return (116*y-16, 500*(x-y), 200*(y-z))

def delta(a, b):
    return math.dist(lab(a), lab(b))

def main():
    data = json.loads(THEMES.read_text())
    assert data['schemaVersion'] == 1
    failures = []
    print('Theme           Mode  Token          Hex      bg     surface  Result')
    for theme in data['themes']:
        for mode in ('light', 'dark'):
            palette = theme[mode]['tokens']
            for token in (*TEXT_TOKENS, 'lotus'):
                ratios = [contrast(rgb(palette[token]), rgb(palette[base])) for base in ('bg', 'surface')]
                passed = min(ratios) >= (3 if token == 'lotus' else 4.5)
                print(f'{theme["id"]:16} {mode:5} {token:14} {palette[token]} {ratios[0]:6.2f} {ratios[1]:8.2f}  {"PASS" if passed else "FAIL"}')
                if not passed: failures.append(f'{theme["id"]}/{mode}/{token}')
            cat = theme[mode]['categories']
            category_ratios = []
            for category, hex_value in cat.items():
                ratio = contrast(rgb(hex_value), rgb(palette['surface']))
                category_ratios.append(ratio)
                if ratio < 3:
                    failures.append(f'{theme["id"]}/{mode}/category/{category} {hex_value}: surface contrast {ratio:.2f}:1 < 3:1 (WCAG 1.4.11)')
            print(f'  Category/surface {theme["id"]}/{mode}: {len(cat)} colors, min contrast={min(category_ratios):.2f}:1 (target 3:1)')
            limit = 10 if theme['id'] == 'monochromeGold' else 15
            distances = []
            for a, b in itertools.combinations(TOP, 2):
                distance = delta(cat[a], cat[b])
                distances.append(distance)
                target = 25 if {a, b} == {'groceries', 'emi'} else limit
                if distance < target: failures.append(f'{theme["id"]}/{mode}/{a}-{b}: ΔE {distance:.2f} < {target}')
            print(f'  Categories {theme["id"]}/{mode}: min ΔE={min(distances):.2f} (target {limit}); groceries/emi={delta(cat["groceries"], cat["emi"]):.2f} (target 25)')
            capsule = tuple(f*.14+b*.86 for f,b in zip(rgb(palette['secondaryText']), rgb(palette['surface'])))
            if contrast(rgb(palette['secondaryText']), capsule) < 4.5:
                failures.append(f'{theme["id"]}/{mode}/demo capsule')
            for token in ('lockGold',):
                if contrast(rgb(palette[token]), rgb(palette['lockBackground'])) < 4.5:
                    failures.append(f'{theme["id"]}/{mode}/lock')
    print(f'\n{len(data["themes"])} themes × 2 modes: {len(failures)} failures')
    for failure in failures: print('FAIL:', failure)
    return bool(failures)

if __name__ == '__main__':
    raise SystemExit(main())
