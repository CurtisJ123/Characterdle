"""Reproduce the approved static-image optimizations without recompressing outputs.

Requires Pillow with WebP support (reference: Pillow 12.3.0 / libwebp 1.6.0).
Run without arguments for an in-memory dry run; --write updates only the seven
approved outputs. Original images come from the pinned Git revision. For shallow
clones, --source-dir can instead point to an original public/ or dist/ directory.
"""

import argparse
import hashlib
import json
import subprocess
from io import BytesIO
from pathlib import Path

from PIL import Image, features


CLIENT_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = CLIENT_ROOT.parent
PUBLIC_ROOT = CLIENT_ROOT / "public"
SOURCE_REVISION = "90c4111a8551d4ffe6c1215f05bcdcd1b879cf86"
PORTRAIT_WIDTH = 600
PORTRAIT_QUALITY = 85
LOGO_SIZE = (192, 192)
LOGO_SOURCE = "brand/characterdle-logo.png"
LOGO_OUTPUT = "brand/characterdle-logo-small.webp"
SOURCE_HASHES = {
    LOGO_SOURCE: "1ac06afd039d5186bdde09d379efb443f01fc6add9c427b62d85fb210360319a",
    "images/GOTCharacterImages/black-walder-rivers.webp": "333e474c5c61b506d5b7d95febba43ac2be96d2e338bbec4acd66b4f35226248",
    "images/GOTCharacterImages/pyp.webp": "04c3c0c2f8679252bf1af3075d09e61242a327223a8a3bbe43387fa222e375b4",
    "images/GOTCharacterImages/qhorin-halfhand.webp": "a22bf31baa3ba0ae8b79dd22f50025ad85ade943ed3d411d4368ab38127f77d7",
    "images/GOTCharacterImages/roslin-frey.webp": "eb87b2973d879cb63168276a199cf062ebcc421082cc42e88410f501d0f30b6c",
    "images/GOTCharacterImages/thoros-of-myr.webp": "9903c0f433ddf6e1dd4022915c2fdd39d796b5372bc84e9c0c6f829056eded30",
    "images/GOTCharacterImages/viserys-targaryen.webp": "84045b37d9b68eb356e8b219064c4a4c657fe7cd184025d477e50f4686aec85e",
}


def read_original(relative_path: str, source_dir: Path | None) -> bytes:
    if source_dir is not None:
        data = (source_dir / relative_path).read_bytes()
    else:
        result = subprocess.run(
            ["git", "show", f"{SOURCE_REVISION}:characterdle.client/public/{relative_path}"],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
        )
        data = result.stdout
    if hashlib.sha256(data).hexdigest() != SOURCE_HASHES[relative_path]:
        raise ValueError(f"Original image does not match the reviewed source: {relative_path}")
    return data


def optimize(relative_path: str, data: bytes) -> tuple[bytes, tuple, tuple]:
    with Image.open(BytesIO(data)) as source:
        if getattr(source, "n_frames", 1) != 1 or source.getexif().get(274, 1) != 1:
            raise ValueError(f"Unexpected animation or orientation: {relative_path}")
        before_size = source.size
        is_logo = relative_path == LOGO_SOURCE
        size = LOGO_SIZE if is_logo else (
            PORTRAIT_WIDTH,
            round(source.height * PORTRAIT_WIDTH / source.width),
        )
        if source.width < size[0] or source.height < size[1]:
            raise ValueError(f"Refusing to upscale: {relative_path}")
        resized = source.resize(size, Image.Resampling.LANCZOS)
        options = {"lossless": True} if is_logo else {"quality": PORTRAIT_QUALITY}
        # Preserve the source color profile; dropping it can visibly shift colors.
        if source.info.get("icc_profile"):
            options["icc_profile"] = source.info["icc_profile"]
        output = BytesIO()
        resized.save(output, format="WEBP", method=6, **options)
        encoded = output.getvalue()
        if len(encoded) >= len(data):
            raise ValueError(f"Optimization did not reduce file size: {relative_path}")
        with Image.open(BytesIO(encoded)) as check:
            check.load()
            if check.size != size or check.mode != source.mode:
                raise ValueError(f"Encoded dimensions or color mode changed: {relative_path}")
        return encoded, before_size, size


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Write the approved optimized outputs.")
    parser.add_argument("--source-dir", type=Path, help="Original public/ or dist/ directory instead of Git.")
    args = parser.parse_args()
    if not features.check("webp"):
        parser.error("Pillow must have WebP support.")

    outputs = []
    report = []
    for relative_path in SOURCE_HASHES:
        original = read_original(relative_path, args.source_dir)
        encoded, before_size, after_size = optimize(relative_path, original)
        output_path = LOGO_OUTPUT if relative_path == LOGO_SOURCE else relative_path
        outputs.append((PUBLIC_ROOT / output_path, encoded))
        report.append({
            "source": relative_path,
            "output": output_path,
            "before_bytes": len(original),
            "after_bytes": len(encoded),
            "saved_bytes": len(original) - len(encoded),
            "before_dimensions": before_size,
            "after_dimensions": after_size,
            "sha256": hashlib.sha256(encoded).hexdigest(),
        })

    # Generate and validate everything before replacing any assets.
    if args.write:
        for path, data in outputs:
            if not path.exists() or path.read_bytes() != data:
                path.write_bytes(data)
    print(json.dumps({
        "write": args.write,
        "pillow_version": Image.__version__,
        "libwebp_version": features.version("webp"),
        "images": report,
    }, indent=2))


if __name__ == "__main__":
    main()
