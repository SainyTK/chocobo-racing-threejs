"""Keyframed clips authored as functions of time, in armature-space angles so they read the same for every bone.

Armature space: +X is the character's left, -Y forward, +Z up. A positive X angle pitches a bone forward and down;
`.R` bones take the mirror of `.L` poses automatically through `mirrored`.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass

import bpy
from mathutils import Euler, Quaternion, Vector

from .geometry import mirror_name

V3 = tuple[float, float, float]
Key = tuple[V3, V3] | tuple[V3, V3, V3]
Pose = dict[str, Key]
"""Bone to (rotation XYZ radians, offset metres[, scale]). Rotation and offset are in armature space; the optional
scale is in the bone's own axes, where Z points up for bones that are not vertical."""


@dataclass
class Clip:
    name: str
    seconds: float
    pose: Callable[[float], Pose]
    """Pose at time t in seconds. Looping clips must return the same pose at 0 and `seconds`."""
    keys: int = 16
    only: tuple[str, ...] = ()
    """Bones this clip animates. Empty keys every bone, at rest where the pose leaves it out, so loops blend cleanly."""
    skip: tuple[str, ...] = ()
    """Bones this clip never keys, so an overlay clip such as a blink owns them alone."""


def mirrored(pose: Pose) -> Pose:
    """Adds `.R` twins of every `.L` entry: rotations about Y and Z flip sign, offsets flip in X."""
    out = dict(pose)
    for bone, ((rx, ry, rz), (ox, oy, oz), *scale) in pose.items():
        twin = mirror_name(bone)
        if twin != bone and twin not in pose:
            out[twin] = ((rx, -ry, -rz), (-ox, oy, oz), *scale)
    return out


def aim(rest: Vector, target: Vector, parent: Quaternion | None = None) -> tuple[V3, Quaternion]:
    """The armature-space rotation that turns a bone from its rest direction to point at `target`, for a bone whose
    parent is already turned by `parent`. Also returns the bone's resulting turn, for its own children."""
    local = (parent.inverted() @ target) if parent else target
    turn = rest.rotation_difference(local)
    e = turn.to_euler("XYZ")
    return (e.x, e.y, e.z), (parent @ turn) if parent else turn


def reach(
    side: str,
    rest: tuple[Vector, Vector],
    upper: Sequence[float],
    lower: Sequence[float],
    k: float = 1.0,
    held: tuple[str, Vector, Sequence[float]] | None = None,
) -> Pose:
    """The `arm.<side>` and `forearm.<side>` bones aimed so the upper arm and forearm point along `upper` and `lower`,
    unit armature-space directions, blended from their unit rest directions `rest` by k. `held` is (bone, rest direction,
    direction) for something in the fist, such as a staff, aimed too whatever the arm does; otherwise it simply turns
    with the forearm."""
    (ax, ay, az), turn = aim(rest[0], rest[0].lerp(Vector(upper), k).normalized())
    (fx, fy, fz), turn = aim(rest[1], rest[1].lerp(Vector(lower), k).normalized(), turn)
    pose: Pose = {f"arm.{side}": ((ax, ay, az), (0, 0, 0)), f"forearm.{side}": ((fx, fy, fz), (0, 0, 0))}
    if held:
        bone, base, direction = held
        pose[bone] = (aim(base, base.lerp(Vector(direction).normalized(), k).normalized(), turn)[0], (0, 0, 0))
    return pose


def bake(rig: bpy.types.Object, clip: Clip, fps: int = 30) -> bpy.types.Action:
    """Keys the clip's bones at evenly spaced frames."""
    action = bpy.data.actions.new(clip.name)
    action.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = action
    frames = max(2, round(clip.seconds * fps))
    for k in range(clip.keys + 1):
        frame = round(frames * k / clip.keys)
        pose = clip.pose(clip.seconds * k / clip.keys)
        for pb in rig.pose.bones:
            if clip.only and pb.name not in clip.only or pb.name in clip.skip:
                continue
            rot, off, *scale = pose.get(pb.name, ((0, 0, 0), (0, 0, 0)))
            rest = pb.bone.matrix_local.to_quaternion()
            pb.rotation_quaternion = rest.inverted() @ Euler(rot, "XYZ").to_quaternion() @ rest
            pb.location = rest.inverted() @ Vector(off)
            pb.scale = scale[0] if scale else (1, 1, 1)
            for path in ("rotation_quaternion", "location", "scale"):
                pb.keyframe_insert(path, frame=frame)
    for pb in rig.pose.bones:
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
        pb.scale = (1, 1, 1)
    rig.animation_data.action = None
    return action
