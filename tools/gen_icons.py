"""Generate PNG app icons: coral background, white up-arrow. Stdlib only."""
import os
import struct
import zlib


def chunk(tag, data):
    c = struct.pack('>I', len(data)) + tag + data
    return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path, size, pixel_fn):
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            rows.extend(pixel_fn(x, y))
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(bytes(rows)))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)


BG = (255, 84, 112, 255)   # #ff5470
FG = (255, 255, 255, 255)


def make(size, path):
    apex_y, base_y = 0.24 * size, 0.60 * size
    half_max, stem_hw, stem_bot = 0.26 * size, 0.09 * size, 0.78 * size
    cx = size / 2

    def px(x, y):
        if apex_y <= y <= base_y:
            hw = (y - apex_y) / (base_y - apex_y) * half_max
            if abs(x - cx) <= hw:
                return FG
        elif base_y < y <= stem_bot and abs(x - cx) <= stem_hw:
            return FG
        return BG

    write_png(path, size, px)


os.makedirs('icons', exist_ok=True)
make(512, 'icons/icon-512.png')
make(192, 'icons/icon-192.png')
make(180, 'icons/apple-touch-icon.png')
print('icons written')
