"""Builds a racer's skinned, textured GLB in headless Blender.

    Blender -b --factory-startup --python-exit-code 1 -P scripts/characters/build.py -- bahamut OUT.glb

The character package (`scripts/characters/<name>/`) provides `model.skeleton()`, `model.parts(skeleton)`,
`paint.PAINTERS`, `paint.SIZES`, `paint.BACKGROUND` and `clips.CLIPS`. Everything else is shared pipeline.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from pipeline import anim, atlas, scene  # noqa: E402

ATLAS = 1024
AO_DISTANCE = 0.45
AO_STRENGTH = 0.4
OUTLINE_KEEP = 0.45


def main(name: str, out: Path) -> None:
    model = importlib.import_module(f"{name}.model")
    paint = importlib.import_module(f"{name}.paint")
    clips = importlib.import_module(f"{name}.clips")
    scene.reset()
    spec = model.skeleton()
    rig = scene.armature("Armature", spec)
    parts = model.parts(spec)
    rects = atlas.pack(paint.SIZES, ATLAS)
    atlas.remap(parts, rects, ATLAS)
    colour = atlas.paint(paint.PAINTERS, rects, ATLAS, paint.BACKGROUND)
    body = scene.body(parts, rig)
    outline = scene.hull(parts, rig, OUTLINE_KEEP)
    scene.bake_ao(body, AO_DISTANCE, AO_STRENGTH)
    texture = scene.image(f"{name}_atlas", colour)
    body.data.materials.append(scene.textured_material(name, texture))
    outline.data.materials.append(scene.plain_material("Outline", paint.OUTLINE))
    for clip in clips.CLIPS:
        anim.bake(rig, clip)
    scene.export(out, [rig, body, outline])
    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
    hull = sum(len(p.vertices) - 2 for p in outline.data.polygons)
    print(f"BUILD {name}: {tris} body triangles, {hull} outline triangles, {len(spec)} bones, {len(clips.CLIPS)} clips -> {out}")


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1 :]
    main(args[0], Path(args[1]))
