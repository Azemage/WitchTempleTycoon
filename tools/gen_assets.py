"""Generates the placeholder tileset and player spritesheet as readable pixel art.

Run with: python3 tools/gen_assets.py
Outputs: assets/tiles/tileset.png (12 tiles, 32x32 each), assets/sprites/player.png (3x4 frames, 32x32 each).
"""
from PIL import Image, ImageDraw
import math
import random

T = 32
random.seed(7)


def new_tile():
    return Image.new('RGBA', (T, T), (0, 0, 0, 0))


def speckle(draw, color, count, area=(0, 0, T, T), size=1):
    x0, y0, x1, y1 = area
    for _ in range(count):
        x = random.randint(x0, x1 - 1)
        y = random.randint(y0, y1 - 1)
        draw.rectangle([x, y, x + size - 1, y + size - 1], fill=color)


def tile_floor_stone():
    img = new_tile()
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, T - 1, T - 1], fill=(120, 116, 112, 255))
    for gx in range(0, T, 16):
        for gy in range(0, T, 16):
            d.rectangle([gx, gy, gx + 15, gy + 15], outline=(90, 86, 84, 255))
    speckle(d, (100, 96, 94, 255), 18)
    speckle(d, (140, 136, 132, 255), 10)
    return img


def tile_floor_wood():
    img = new_tile()
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, T - 1, T - 1], fill=(150, 105, 62, 255))
    for y in range(0, T, 8):
        shade = (134, 92, 52, 255) if (y // 8) % 2 == 0 else (160, 114, 68, 255)
        d.rectangle([0, y, T - 1, y + 7], fill=shade)
        d.line([0, y, T - 1, y], fill=(110, 75, 42, 255))
    speckle(d, (120, 82, 46, 255), 8)
    return img


def tile_wall():
    img = new_tile()
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, T - 1, T - 1], fill=(58, 50, 64, 255))
    brick_h = 8
    row = 0
    for y in range(0, T, brick_h):
        offset = 8 if row % 2 else 0
        for x in range(-8, T, 16):
            d.rectangle([x + offset, y, x + offset + 14, y + brick_h - 2], outline=(38, 32, 44, 255), fill=(70, 60, 78, 255))
        row += 1
    return img


def tile_carpet():
    img = new_tile()
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, T - 1, T - 1], fill=(94, 24, 86, 255))
    d.rectangle([2, 2, T - 3, T - 3], outline=(214, 178, 64, 255), width=2)
    d.ellipse([T // 2 - 5, T // 2 - 5, T // 2 + 5, T // 2 + 5], outline=(214, 178, 64, 255), width=1)
    return img


def tile_door():
    img = new_tile()
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, T - 1, T - 1], fill=(40, 34, 46, 255))
    d.rectangle([5, 2, T - 6, T - 1], fill=(96, 62, 36, 255), outline=(56, 36, 20, 255))
    d.rectangle([8, 6, T - 9, 14], outline=(56, 36, 20, 255))
    d.rectangle([8, 18, T - 9, T - 4], outline=(56, 36, 20, 255))
    d.ellipse([T - 12, 16, T - 9, 19], fill=(214, 178, 64, 255))
    return img


def tile_cauldron():
    img = new_tile()
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, T - 1, T - 1], fill=(58, 50, 64, 255))
    d.ellipse([6, 14, T - 7, T - 4], fill=(28, 26, 32, 255), outline=(10, 10, 12, 255))
    d.rectangle([4, 12, T - 5, 18], fill=(28, 26, 32, 255))
    d.ellipse([8, 9, T - 9, 16], fill=(96, 200, 120, 255))
    d.ellipse([12, 6, T - 14, 11], fill=(132, 224, 150, 255))
    d.line([6, 12, 2, 6], fill=(20, 18, 22, 255), width=2)
    d.line([T - 7, 12, T - 3, 6], fill=(20, 18, 22, 255), width=2)
    return img


def tile_table():
    img = new_tile()
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, T - 1, T - 1], fill=(58, 50, 64, 255))
    d.rectangle([2, 10, T - 3, 20], fill=(132, 92, 54, 255), outline=(90, 60, 34, 255))
    d.rectangle([5, 20, 8, T - 3], fill=(90, 60, 34, 255))
    d.rectangle([T - 9, 20, T - 6, T - 3], fill=(90, 60, 34, 255))
    d.rectangle([10, 4, 14, 11], fill=(146, 64, 168, 255))
    d.rectangle([18, 2, 24, 11], fill=(70, 140, 200, 255))
    return img


def tile_counter():
    img = new_tile()
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, T - 1, T - 1], fill=(58, 50, 64, 255))
    d.rectangle([1, 14, T - 2, T - 2], fill=(110, 100, 92, 255), outline=(76, 68, 62, 255))
    d.rectangle([1, 9, T - 2, 15], fill=(140, 128, 116, 255), outline=(76, 68, 62, 255))
    for x in (6, 14, 22):
        d.rectangle([x, 2, x + 4, 8], fill=(196, 140, 64, 255), outline=(120, 84, 36, 255))
    return img


def tile_grass():
    img = new_tile()
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, T - 1, T - 1], fill=(70, 124, 58, 255))
    speckle(d, (58, 108, 48, 255), 14, size=2)
    speckle(d, (88, 144, 70, 255), 10, size=2)
    for _ in range(3):
        x, y = random.randint(2, T - 4), random.randint(2, T - 4)
        d.ellipse([x, y, x + 2, y + 2], fill=(228, 210, 96, 255))
    return img


def tile_path():
    img = new_tile()
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, T - 1, T - 1], fill=(176, 150, 104, 255))
    speckle(d, (150, 126, 84, 255), 16, size=2)
    speckle(d, (196, 172, 126, 255), 10, size=1)
    return img


def tile_tree():
    img = new_tile()
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, T - 1, T - 1], fill=(70, 124, 58, 255))
    d.rectangle([T // 2 - 2, T - 9, T // 2 + 2, T - 1], fill=(96, 64, 36, 255))
    d.ellipse([3, 1, T - 4, T - 12], fill=(40, 96, 46, 255), outline=(28, 70, 32, 255))
    d.ellipse([7, 4, T - 9, T - 18], fill=(58, 128, 62, 255))
    return img


def tile_stall():
    img = new_tile()
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, T - 1, T - 1], fill=(176, 150, 104, 255))
    d.polygon([(2, 10), (T - 3, 10), (T - 6, 2), (5, 2)], fill=(178, 50, 58, 255), outline=(110, 28, 34, 255))
    d.rectangle([2, 10, T - 3, 13], fill=(214, 90, 96, 255))
    d.rectangle([5, 13, 9, T - 2], fill=(120, 84, 50, 255))
    d.rectangle([T - 10, 13, T - 6, T - 2], fill=(120, 84, 50, 255))
    d.rectangle([10, 18, T - 11, T - 4], fill=(96, 66, 40, 255), outline=(70, 48, 28, 255))
    return img


def build_tileset():
    tiles = [
        tile_floor_stone(), tile_floor_wood(), tile_wall(), tile_carpet(),
        tile_door(), tile_cauldron(), tile_table(), tile_counter(),
        tile_grass(), tile_path(), tile_tree(), tile_stall(),
    ]
    sheet = Image.new('RGBA', (T * len(tiles), T), (0, 0, 0, 0))
    for i, tile in enumerate(tiles):
        sheet.paste(tile, (i * T, 0))
    sheet.save('assets/tiles/tileset.png')


SKIN = (224, 188, 152, 255)
ROBE = (58, 38, 92, 255)
ROBE_DARK = (40, 26, 68, 255)
HAT = (30, 20, 52, 255)
HAT_BAND = (214, 178, 64, 255)


def draw_witch(d, facing, leg_offset):
    # facing: 'down', 'left', 'right', 'up'
    cx = T // 2
    # robe (triangle skirt)
    d.polygon([(cx - 8, T - 6), (cx + 8, T - 6), (cx + 5, 16), (cx - 5, 16)], fill=ROBE, outline=ROBE_DARK)
    # legs / feet peeking with walk offset
    d.rectangle([cx - 6 + leg_offset, T - 6, cx - 2 + leg_offset, T - 2], fill=(34, 24, 20, 255))
    d.rectangle([cx + 2 - leg_offset, T - 6, cx + 6 - leg_offset, T - 2], fill=(34, 24, 20, 255))
    # head
    if facing == 'down':
        d.ellipse([cx - 6, 6, cx + 6, 17], fill=SKIN)
        d.polygon([(cx - 9, 8), (cx + 9, 8), (cx, -4)], fill=HAT)
        d.rectangle([cx - 9, 7, cx + 9, 9], fill=HAT_BAND)
        d.ellipse([cx - 3, 11, cx - 1, 13], fill=(20, 16, 16, 255))
        d.ellipse([cx + 1, 11, cx + 3, 13], fill=(20, 16, 16, 255))
    elif facing == 'up':
        d.ellipse([cx - 6, 6, cx + 6, 17], fill=SKIN)
        d.polygon([(cx - 9, 8), (cx + 9, 8), (cx, -4)], fill=HAT)
        d.rectangle([cx - 9, 7, cx + 9, 9], fill=HAT_BAND)
    elif facing == 'left':
        d.ellipse([cx - 7, 6, cx + 5, 17], fill=SKIN)
        d.polygon([(cx - 10, 8), (cx + 8, 8), (cx - 2, -4)], fill=HAT)
        d.rectangle([cx - 10, 7, cx + 8, 9], fill=HAT_BAND)
        d.ellipse([cx - 6, 11, cx - 4, 13], fill=(20, 16, 16, 255))
    elif facing == 'right':
        d.ellipse([cx - 5, 6, cx + 7, 17], fill=SKIN)
        d.polygon([(cx - 8, 8), (cx + 10, 8), (cx + 2, -4)], fill=HAT)
        d.rectangle([cx - 8, 7, cx + 10, 9], fill=HAT_BAND)
        d.ellipse([cx + 4, 11, cx + 6, 13], fill=(20, 16, 16, 255))


def build_player():
    rows = ['down', 'left', 'right', 'up']
    offsets = [0, 3, 0]
    sheet = Image.new('RGBA', (T * 3, T * len(rows)), (0, 0, 0, 0))
    for r, facing in enumerate(rows):
        for c, off in enumerate(offsets):
            img = new_tile()
            d = ImageDraw.Draw(img)
            leg_offset = off if c != 2 else -off
            draw_witch(d, facing, leg_offset)
            sheet.paste(img, (c * T, r * T))
    sheet.save('assets/sprites/player.png')


if __name__ == '__main__':
    build_tileset()
    build_player()
    print('Assets generated.')
