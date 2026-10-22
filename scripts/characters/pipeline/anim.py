"""Keyframed clips authored as functions of time, in armature-space angles so they read the same for every bone.

Armature space: +X is the character's left, -Y forward, +Z up. A positive X angle pitches a bone forward and down;
`.R` bones take the mirror of `.L` poses automatically through `mirrored`.
"""

from __future__ import annotations

from collections.abc import Callable
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
