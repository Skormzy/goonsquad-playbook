import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-dir', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--file-prefix', default='cmu-sprint')
    parser.add_argument('--title', default='CMU LOWER-BODY RETARGET - CAPTURED GAIT + AUTHORED STICK CONTROL')
    parser.add_argument('--frames', default='1,7,13,19')
    args = parser.parse_args()
    input_dir = Path(args.input_dir).resolve()
    output = Path(args.output).resolve()
    views = ('front', 'side', 'three-quarter')
    frames = tuple(int(value.strip()) for value in args.frames.split(',') if value.strip())
    if len(frames) != 4:
        raise RuntimeError('Contact sheet requires four sample frames.')
    tile_width = 288
    tile_height = 360
    header_height = 58
    sheet = Image.new('RGB', (tile_width * len(frames), tile_height * len(views) + header_height), '#090d14')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=15)
    draw.text((18, 18), args.title, fill='#70e8ff', font=font)
    for row, view in enumerate(views):
        for column, frame in enumerate(frames):
            source = input_dir / f'{args.file_prefix}-{view}-frame-{frame:03d}.png'
            if not source.exists():
                raise RuntimeError(f'Missing retarget review render: {source}')
            image = Image.open(source).convert('RGB').resize((tile_width, tile_height), Image.Resampling.LANCZOS)
            sheet.paste(image, (column * tile_width, header_height + row * tile_height))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, optimize=True)


if __name__ == '__main__':
    main()
