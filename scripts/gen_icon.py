import struct
import zlib

SIZE = 1024


def make_pixels():
    rows = []
    accent = (10, 132, 255)  # Apple-like blue
    accent2 = (52, 170, 255)
    white = (255, 255, 255)
    for y in range(SIZE):
        row = bytearray()
        row.append(0)  # filter type
        t = y / SIZE
        r = int(accent[0] + (accent2[0] - accent[0]) * t)
        g = int(accent[1] + (accent2[1] - accent[1]) * t)
        b = int(accent[2] + (accent2[2] - accent[2]) * t)
        for x in range(SIZE):
            # rounded-square mask
            cx, cy = SIZE / 2, SIZE / 2
            margin = SIZE * 0.06
            radius = SIZE * 0.22
            # distance to nearest edge for rounded rect corners
            left, top, right, bottom = margin, margin, SIZE - margin, SIZE - margin
            dx = max(left - x, 0, x - right)
            dy = max(top - y, 0, y - bottom)
            in_rect = left <= x <= right and top <= y <= bottom
            corner = False
            if in_rect:
                # check corners
                near_left = x < left + radius
                near_right = x > right - radius
                near_top = y < top + radius
                near_bottom = y > bottom - radius
                if near_left and near_top:
                    ddx, ddy = (left + radius) - x, (top + radius) - y
                    if ddx * ddx + ddy * ddy > radius * radius:
                        corner = True
                elif near_right and near_top:
                    ddx, ddy = x - (right - radius), (top + radius) - y
                    if ddx * ddx + ddy * ddy > radius * radius:
                        corner = True
                elif near_left and near_bottom:
                    ddx, ddy = (left + radius) - x, y - (bottom - radius)
                    if ddx * ddx + ddy * ddy > radius * radius:
                        corner = True
                elif near_right and near_bottom:
                    ddx, ddy = x - (right - radius), y - (bottom - radius)
                    if ddx * ddx + ddy * ddy > radius * radius:
                        corner = True

            if in_rect and not corner:
                # document glyph: white rounded rect with folded corner + lines
                doc_left, doc_top = SIZE * 0.32, SIZE * 0.22
                doc_right, doc_bottom = SIZE * 0.68, SIZE * 0.80
                fold = SIZE * 0.10
                is_doc = doc_left <= x <= doc_right and doc_top <= y <= doc_bottom
                is_fold_cut = (x > doc_right - fold) and (y < doc_top + fold) and (
                    (doc_right - x) + (y - doc_top) < fold
                )
                if is_doc and not is_fold_cut:
                    row += bytes(white) + b"\xff"
                else:
                    # subtle lines to suggest text
                    line_h = SIZE * 0.045
                    is_line = False
                    for i in range(4):
                        ly0 = doc_top + SIZE * 0.16 + i * line_h * 1.7
                        ly1 = ly0 + line_h * 0.55
                        lx1 = doc_right - SIZE * 0.05 if i != 3 else doc_left + (doc_right - doc_left) * 0.6
                        if ly0 <= y <= ly1 and doc_left + SIZE * 0.05 <= x <= lx1:
                            is_line = True
                            break
                    if is_line:
                        row += bytes((r, g, b)) + b"\x00"
                    else:
                        row += bytes((r, g, b)) + b"\xff"
            else:
                row += b"\x00\x00\x00\x00"
        rows.append(bytes(row))
    return b"".join(rows)


def write_png(path, size):
    raw = make_pixels()
    # downscale by nearest-neighbor if size != SIZE
    if size != SIZE:
        scale = SIZE / size
        rows = []
        stride = 1 + SIZE * 4
        for y in range(size):
            sy = min(int(y * scale), SIZE - 1)
            src_row = raw[sy * stride: sy * stride + stride]
            row = bytearray()
            row.append(0)
            for x in range(size):
                sx = min(int(x * scale), SIZE - 1)
                off = 1 + sx * 4
                row += src_row[off: off + 4]
            rows.append(bytes(row))
        raw = b"".join(rows)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw, 9)
    with open(path, "wb") as f:
        f.write(sig)
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", idat))
        f.write(chunk(b"IEND", b""))


if __name__ == "__main__":
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "icon-source.png"
    write_png(out, SIZE)
    print("wrote", out)
