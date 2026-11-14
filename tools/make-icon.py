#!/usr/bin/env python3
"""Generates the ProcessDraw app icons in build/ (replaces the draw.io logo).

Motif: a vessel feeding a centrifugal pump through a pipe, white on a blue tile.
Run from the repository root: python3 tools/make-icon.py
"""
import os
from PIL import Image, ImageDraw

BG = (21, 101, 192, 255)
FG = (255, 255, 255, 255)
ACCENT = (255, 193, 7, 255)
S = 1024


def svg():
	return f'''<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" width="{S}" height="{S}">
	<rect x="0" y="0" width="{S}" height="{S}" rx="180" fill="#1565C0"/>
	<g fill="none" stroke="#FFFFFF" stroke-width="44" stroke-linejoin="round" stroke-linecap="round">
		<rect x="190" y="170" width="240" height="460" rx="120"/>
		<path d="M310 630 V710 H550"/>
		<circle cx="680" cy="710" r="130"/>
		<path d="M680 580 H850"/>
	</g>
	<path d="M635 650 L745 710 L635 770 Z" fill="#FFC107"/>
</svg>
'''


def draw(size):
	k = 4
	n = size * k
	f = n / S
	im = Image.new('RGBA', (n, n), (0, 0, 0, 0))
	d = ImageDraw.Draw(im)
	w = round(44 * f)
	d.rounded_rectangle([0, 0, n - 1, n - 1], radius=round(180 * f), fill=BG)
	d.rounded_rectangle([190 * f, 170 * f, 430 * f, 630 * f], radius=round(120 * f), outline=FG, width=w)
	d.line([(310 * f, 630 * f), (310 * f, 710 * f), (550 * f, 710 * f)], fill=FG, width=w, joint='curve')
	d.ellipse([550 * f, 580 * f, 810 * f, 840 * f], outline=FG, width=w)
	d.line([(680 * f, 580 * f), (850 * f, 580 * f)], fill=FG, width=w)
	d.polygon([(635 * f, 650 * f), (745 * f, 710 * f), (635 * f, 770 * f)], fill=ACCENT)
	for cx, cy in [(310, 710), (850, 580)]:
		r = w / 2
		d.ellipse([cx * f - r, cy * f - r, cx * f + r, cy * f + r], fill=FG)
	return im.resize((size, size), Image.LANCZOS)


def tile(w, h, logo):
	im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
	s = min(w, h)
	im.paste(draw(s), ((w - s) // 2, (h - s) // 2))
	return im


def main():
	root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
	b = os.path.join(root, 'build')

	with open(os.path.join(b, 'icon.svg'), 'w') as fh:
		fh.write(svg())

	big = draw(S)
	big.save(os.path.join(b, 'icon.png'))
	big.save(os.path.join(b, '1024x1024.png'))

	for s in [16, 32, 48, 64, 96, 128, 192, 256, 512, 720]:
		draw(s).save(os.path.join(b, f'{s}x{s}.png'))

	big.save(os.path.join(b, 'icon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
	big.save(os.path.join(b, 'icon.icns'))

	appx = os.path.join(b, 'appx')
	for name, w, h in [('BadgeLogo', 512, 512), ('LargeTile', 310, 310), ('SmallTile', 71, 71),
			('Square150x150Logo', 150, 150), ('Square44x44Logo', 44, 44), ('StoreLogo', 64, 64),
			('Wide310x150Logo', 310, 150)]:
		tile(w, h, big).save(os.path.join(appx, name + '.png'))

	img = os.path.join(root, 'drawio', 'src', 'main', 'webapp', 'images')
	draw(256).save(os.path.join(img, 'processdraw256.png'))

	# The editor's own draw.io logo files (splash, home screen, banners, favicons)
	for name in ['drawlogo48', 'drawlogo80', 'drawlogo128', 'drawlogo144', 'drawlogo256', 'favicon-16x16',
			'favicon-32x32', 'logo-flat-small', 'logo', 'apple-touch-icon', 'android-chrome-512x512',
			'icon-192', 'icon-512', 'icon-192-maskable', 'icon-512-maskable', 'logo-flat', 'logo-white']:
		path = os.path.join(img, name + '.png')
		w, h = Image.open(path).size
		tile(w, h, big).save(path)
	gray = draw(48)
	alpha = gray.getchannel('A')
	gray = gray.convert('L').convert('RGBA')
	gray.putalpha(alpha)
	gray.save(os.path.join(img, 'drawlogo48-gray.png'))
	for name in ['drawlogo', 'drawlogo-color', 'drawlogo-gray', 'drawlogo-text-bottom', 'drawio']:
		with open(os.path.join(img, name + '.svg'), 'w') as fh:
			fh.write(svg())
	big.save(os.path.join(root, 'drawio', 'src', 'main', 'webapp', 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])


if __name__ == '__main__':
	main()
