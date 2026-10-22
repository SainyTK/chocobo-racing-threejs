"""Blender scene assembly: armature, the skinned body mesh, its outline hull, the baked atlas and the GLB export."""

from __future__ import annotations

from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector

from .geometry import Part

BoneSpec = tuple[tuple[float, float, float], tuple[float, float, float], str | None]
"""(head, tail, parent) in armature space."""


def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 30


def armature(name: str, bones: dict[str, BoneSpec]) -> bpy.types.Object:
    data = bpy.data.armatures.new(name)
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    for bone, (head, tail, _) in bones.items():
        eb = data.edit_bones.new(bone)
        eb.head, eb.tail = head, tail
        # Rolls follow the world so the left and right chains are mirror images.
        eb.align_roll(Vector((0, -1, 0)) if abs((Vector(tail) - Vector(head)).normalized().z) > 0.9 else Vector((0, 0, 1)))
    for bone, (_, _, parent) in bones.items():
        if parent:
            data.edit_bones[bone].parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in obj.pose.bones:
        pb.rotation_mode = "QUATERNION"
    return obj


def part_object(part: Part) -> bpy.types.Object:
    """One part as a mesh object with per-corner UVs, outward normals and vertex groups."""
    mesh = bpy.data.meshes.new(part.name)
    mesh.from_pydata([tuple(v) for v in part.verts], [], part.faces)
    uv = mesh.uv_layers.new(name="UVMap")
    k = 0
    for face_uvs in part.uvs:
        for coord in face_uvs:
            uv.data[k].uv = coord
            k += 1
    if part.closed:
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(mesh)
        bm.free()
    obj = bpy.data.objects.new(part.name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for i, w in enumerate(part.weights):
        for bone, value in w.items():
            group = obj.vertex_groups.get(bone) or obj.vertex_groups.new(name=bone)
            group.add([i], value, "REPLACE")
    return obj


def join(objects: list[bpy.types.Object], name: str) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = obj.data.name = name
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def skin(obj: bpy.types.Object, rig: bpy.types.Object) -> None:
    obj.parent = rig
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = rig


def body(parts: list[Part], rig: bpy.types.Object) -> bpy.types.Object:
    obj = join([part_object(p) for p in parts], "Body")
    skin(obj, rig)
    return obj


def hull(parts: list[Part], rig: bpy.types.Object, keep: float, weld: float = 0.004) -> bpy.types.Object:
    """The outline hull: outlined parts welded into smooth shells, decimated to `keep` of their triangles, no UVs.

    The game draws it inflated along its normals and back-facing, so only the silhouette matters.
    """
    obj = join([part_object(p) for p in parts if p.outline], "Outline")
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=weld)
    bm.to_mesh(obj.data)
    bm.free()
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new("Decimate", "DECIMATE")
    mod.ratio = keep
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    while obj.data.uv_layers:
        obj.data.uv_layers.remove(obj.data.uv_layers[0])
    skin(obj, rig)
    return obj


def image(name: str, rgb: np.ndarray) -> bpy.types.Image:
    """A Blender image from top-to-bottom float RGB rows."""
    h, w, _ = rgb.shape
    img = bpy.data.images.new(name, w, h, alpha=False)
    rgba = np.ones((h, w, 4), np.float32)
    rgba[..., :3] = rgb[::-1]
    img.pixels.foreach_set(rgba.ravel())
    img.update()
    return img


def textured_material(name: str, img: bpy.types.Image, glow: bpy.types.Image | None = None) -> bpy.types.Material:
    """The body's material: the atlas as base colour and, when given, a glow mask as emission (glTF emissiveTexture)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = img
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if glow:
        emission = nodes.new("ShaderNodeTexImage")
        emission.image = glow
        mat.node_tree.links.new(emission.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 1.0
    mat.use_backface_culling = True
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    return mat


def plain_material(name: str, colour: str) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    h = colour.lstrip("#")
    bsdf.inputs["Base Color"].default_value = (*(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)), 1)
    mat.use_backface_culling = True
    return mat


def bake_ao(obj: bpy.types.Object, distance: float, strength: float, samples: int = 128) -> None:
    """Ambient occlusion baked into a vertex colour attribute, scaled so 1 is open and 1 - strength fully occluded.

    Vertex colours need no unique UV space, so mirrored and repeated parts can keep sharing atlas rectangles.
    """
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    if scene.world is None:
        scene.world = bpy.data.worlds.new("World")
    scene.world.light_settings.distance = distance
    attr = obj.data.color_attributes.new("AO", "BYTE_COLOR", "POINT")
    obj.data.color_attributes.active_color = attr
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS", use_clear=True)
    values = np.empty(len(attr.data) * 4, np.float32)
    attr.data.foreach_get("color_srgb", values)
    values = values.reshape(-1, 4)
    ao = smooth(obj.data, values[:, 0], 3)
    values[:, :3] = (1 - strength * (1 - ao))[:, None]
    attr.data.foreach_set("color_srgb", values.ravel())


def smooth(mesh: bpy.types.Mesh, value: np.ndarray, passes: int) -> np.ndarray:
    """Averages a per-vertex value with its neighbours, which removes the speckle of a sampled bake."""
    edges = np.empty(len(mesh.edges) * 2, np.int64)
    mesh.edges.foreach_get("vertices", edges)
    a, b = edges[0::2], edges[1::2]
    for _ in range(passes):
        total, count = value.copy(), np.ones_like(value)
        np.add.at(total, a, value[b])
        np.add.at(total, b, value[a])
        np.add.at(count, a, 1)
        np.add.at(count, b, 1)
        value = total / count
    return value


def export(path: Path, objects: list[bpy.types.Object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_skins=True,
        export_def_bones=False,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_optimize_animation_size=True,
        export_optimize_animation_keep_anim_armature=False,
        export_anim_slide_to_zero=True,
        export_image_format="WEBP",
        export_image_quality=92,
        export_morph=False,
        export_meshopt_compression_enable=True,
        export_vertex_color="ACTIVE",
        export_cameras=False,
        export_lights=False,
    )
