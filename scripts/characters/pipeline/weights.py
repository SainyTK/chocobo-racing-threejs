"""Skin weights computed from part geometry, so no manual weight painting is needed.

Lofted limbs blend between consecutive bones along their length; membranes and loose shapes weight by distance to
bone segments. Every vertex ends with at most four normalised influences, the glTF limit.
"""

from __future__ import annotations

from collections.abc import Sequence

from mathutils import Vector

from .geometry import Part, smoothstep

Bones = dict[str, tuple[Vector, Vector]]
"""Bone name to (head, tail) in armature space."""


def rigid(part: Part, bone: str) -> Part:
    part.weights = [{bone: 1.0} for _ in part.verts]
    return part


def along(part: Part, chain: Sequence[tuple[str, float]], blend: float = 0.08) -> Part:
    """Weights by the loft parameter v: bone i owns v from its start to the next bone's start, blending by `blend`."""
    out = []
    for _, v in part.params:
        w: dict[str, float] = {}
        for i, (bone, start) in enumerate(chain):
            enter = 1.0 if i == 0 else smoothstep(start - blend, start + blend, v)
            leave = 0.0 if i == len(chain) - 1 else smoothstep(chain[i + 1][1] - blend, chain[i + 1][1] + blend, v)
            if enter - leave > 1e-4:
                w[bone] = enter - leave
        out.append(w)
    part.weights = [limit(w) for w in out]
    return part


def nearest(part: Part, bones: Bones, names: Sequence[str], power: float = 4.0) -> Part:
    """Weights by inverse distance to the named bone segments."""
    part.weights = [limit({n: 1.0 / max(1e-4, segment_distance(v, *bones[n])) ** power for n in names}) for v in part.verts]
    return part


def segment_distance(p: Vector, a: Vector, b: Vector) -> float:
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-9, ab.length_squared)))
    return (a + ab * t - p).length


def limit(w: dict[str, float], count: int = 4) -> dict[str, float]:
    top = sorted(w.items(), key=lambda kv: -kv[1])[:count]
    total = sum(v for _, v in top) or 1.0
    kept = [(k, v) for k, v in top if v / total > 0.01]
    total = sum(v for _, v in kept)
    return {k: v / total for k, v in kept}
