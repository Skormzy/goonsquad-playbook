import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-dir', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    input_dir = Path(args.input_dir).resolve()
    output = Path(args.output).resolve()
    names = [
        'neutral-front',
        'neutral-side',
        'neutral-rear',
        'neutral-three-quarter',
        'neutral-broadcast',
        'deformation-stick-ready-front',
        'deformation-stick-ready-three-quarter',
        'deformation-lunge-side',
        'deformation-lunge-three-quarter',
    ]
    images = [
        Image.open(input_dir / f'{name}.png').convert('RGB').resize((300, 400), Image.Resampling.LANCZOS)
        for name in names
    ]
    tile_width, tile_height = images[0].size
    label_height = 34
    columns = 3
    rows = 3
    sheet = Image.new('RGB', (tile_width * columns, (tile_height + label_height) * rows), '#11151b')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=13)

    for index, (name, image) in enumerate(zip(names, images)):
        column = index % columns
        row = index // columns
        x = column * tile_width
        y = row * (tile_height + label_height)
        sheet.paste(image, (x, y + label_height))
        draw.rectangle((x, y, x + tile_width, y + label_height), fill='#11151b')
        draw.text((x + 12, y + 7), name.replace('-', ' ').upper(), fill='#dbe7f3', font=font)

    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, optimize=True)


if __name__ == '__main__':
    main()
