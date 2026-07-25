"""
Vex Vale / The Facet Fox — low-poly greybox generator for Blender.

How to use:
1. Open Blender 4.x or 3.x.
2. Open this file in the Text Editor, or run:
   blender --python vex_vale_blender_rigged_blockout_generator.py
3. The script creates a low-poly character blockout, a simple rigid-part armature,
   and placeholder animation Actions for the first movement milestone.
4. Review the Actions in the Dope Sheet / Action Editor.

Notes:
- This is a greybox production asset, not final art.
- Mesh pieces are rigidly parented to bones so the animations are easy to inspect.
- Replace rigid pieces with a skinned mesh later once proportions and gameplay feel are approved.
- Character uses Z-up, +X forward/right, Y depth/camera side.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Dict, Tuple

import bpy
from mathutils import Matrix, Vector

# Flip these to True if you want the script to save/export automatically when run locally.
SAVE_BLEND_ON_RUN = False
EXPORT_FBX_ON_RUN = False

Color = Tuple[float, float, float, float]

COLORS: Dict[str, Color] = {
    "MAT_Dark_Navy": (0.10, 0.12, 0.23, 1.0),
    "MAT_Charcoal": (0.13, 0.13, 0.16, 1.0),
    "MAT_Deep_Purple": (0.25, 0.16, 0.39, 1.0),
    "MAT_Teal_Accent": (0.11, 0.75, 0.71, 1.0),
    "MAT_Gold_Accent": (0.86, 0.67, 0.29, 1.0),
    "MAT_Gem_Cyan": (0.26, 0.87, 1.00, 1.0),
    "MAT_Warm_Brown": (0.36, 0.24, 0.15, 1.0),
    "MAT_Sole_Light": (0.35, 0.39, 0.45, 1.0),
}


def deg(value: float) -> float:
    return math.radians(value)


def clean_scene() -> None:
    bpy.ops.object.mode_set(mode='OBJECT') if bpy.ops.object.mode_set.poll() else None
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()


def make_materials() -> Dict[str, bpy.types.Material]:
    materials: Dict[str, bpy.types.Material] = {}
    for name, color in COLORS.items():
        mat = bpy.data.materials.new(name)
        mat.diffuse_color = color
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        if bsdf:
            bsdf.inputs['Base Color'].default_value = color
            bsdf.inputs['Roughness'].default_value = 0.72
        materials[name] = mat
    return materials


def assign_mat(obj: bpy.types.Object, mat: bpy.types.Material) -> bpy.types.Object:
    obj.data.materials.append(mat)
    return obj


def apply_flat_lowpoly(obj: bpy.types.Object) -> bpy.types.Object:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_flat()
    except Exception:
        pass
    obj.select_set(False)
    return obj


def add_cube(name: str, extents, center, material: bpy.types.Material, rotation=None) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "_Mesh"
    obj.dimensions = extents
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rotation is not None:
        obj.rotation_euler = rotation
    obj.location = center
    assign_mat(obj, material)
    return apply_flat_lowpoly(obj)


def add_ico_sphere(name: str, radii, center, material: bpy.types.Material, subdivisions: int = 1) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1.0, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "_Mesh"
    obj.scale = radii
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.location = center
    assign_mat(obj, material)
    return apply_flat_lowpoly(obj)


def z_track_rotation(start, end):
    direction = Vector(end) - Vector(start)
    if direction.length < 0.0001:
        return (0, 0, 0)
    return direction.to_track_quat('Z', 'Y').to_euler()


def add_cylinder_between(name: str, start, end, radius: float, material: bpy.types.Material, vertices: int = 6) -> bpy.types.Object:
    start_v = Vector(start)
    end_v = Vector(end)
    midpoint = (start_v + end_v) * 0.5
    length = (end_v - start_v).length
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=length, location=midpoint)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "_Mesh"
    obj.rotation_euler = z_track_rotation(start, end)
    assign_mat(obj, material)
    return apply_flat_lowpoly(obj)


def add_cone_between(name: str, base, tip, radius: float, material: bpy.types.Material, vertices: int = 5) -> bpy.types.Object:
    base_v = Vector(base)
    tip_v = Vector(tip)
    midpoint = (base_v + tip_v) * 0.5
    length = (tip_v - base_v).length
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=0.0, depth=length, location=midpoint)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "_Mesh"
    obj.rotation_euler = z_track_rotation(base, tip)
    assign_mat(obj, material)
    return apply_flat_lowpoly(obj)


def add_prism_between(name: str, start, end, thickness: float, depth: float, material: bpy.types.Material) -> bpy.types.Object:
    start_v = Vector(start)
    end_v = Vector(end)
    midpoint = (start_v + end_v) * 0.5
    length = (end_v - start_v).length
    obj = add_cube(name, (depth, thickness, length), (0, 0, 0), material)
    obj.rotation_euler = z_track_rotation(start, end)
    obj.location = midpoint
    return obj


def add_frustum_box(name: str, height: float, bottom_x: float, bottom_y: float, top_x: float, top_y: float, center, material: bpy.types.Material) -> bpy.types.Object:
    z0 = -height / 2.0
    z1 = height / 2.0
    bx, by = bottom_x / 2.0, bottom_y / 2.0
    tx, ty = top_x / 2.0, top_y / 2.0
    verts = [
        (-bx, -by, z0), (bx, -by, z0), (bx, by, z0), (-bx, by, z0),
        (-tx, -ty, z1), (tx, -ty, z1), (tx, ty, z1), (-tx, ty, z1),
    ]
    faces = [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    ]
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = center
    assign_mat(obj, material)
    return apply_flat_lowpoly(obj)


def add_diamond(name: str, center, radius: float, height: float, material: bpy.types.Material) -> bpy.types.Object:
    cx, cy, cz = center
    verts = [
        (cx, cy, cz + height / 2.0),
        (cx + radius, cy, cz),
        (cx, cy + radius, cz),
        (cx - radius, cy, cz),
        (cx, cy - radius, cz),
        (cx, cy, cz - height / 2.0),
    ]
    faces = [
        (0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 4, 1),
        (5, 2, 1), (5, 3, 2), (5, 4, 3), (5, 1, 4),
    ]
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    assign_mat(obj, material)
    return apply_flat_lowpoly(obj)


def build_meshes(materials: Dict[str, bpy.types.Material]) -> Dict[str, bpy.types.Object]:
    objects: Dict[str, bpy.types.Object] = {}

    def add(obj: bpy.types.Object) -> bpy.types.Object:
        objects[obj.name] = obj
        return obj

    add(add_frustum_box('CH_Vex_Torso_Undersuit', 0.55, 0.18, 0.28, 0.24, 0.46, (0, 0, 1.12), materials['MAT_Deep_Purple']))
    add(add_frustum_box('CH_Vex_Cropped_Jacket', 0.40, 0.21, 0.33, 0.27, 0.50, (0.005, 0, 1.19), materials['MAT_Dark_Navy']))
    add(add_cube('CH_Vex_Pelvis', (0.22, 0.30, 0.16), (0.0, 0, 0.83), materials['MAT_Deep_Purple']))
    add(add_cube('CH_Vex_Belt', (0.25, 0.36, 0.055), (0.0, 0, 0.93), materials['MAT_Gold_Accent']))

    add(add_ico_sphere('CH_Vex_Head_DarkFace', (0.145, 0.145, 0.18), (0.04, 0, 1.56), materials['MAT_Charcoal'], 1))
    add(add_ico_sphere('CH_Vex_Hood_Cowl', (0.19, 0.18, 0.215), (0.015, 0, 1.57), materials['MAT_Dark_Navy'], 1))
    add(add_cube('CH_Vex_Mask_SidePanel_L', (0.12, 0.015, 0.08), (0.095, -0.185, 1.58), materials['MAT_Charcoal']))
    add(add_cube('CH_Vex_Mask_SidePanel_R', (0.12, 0.015, 0.08), (0.095, 0.185, 1.58), materials['MAT_Charcoal']))
    add(add_cube('CH_Vex_Eye_Glow_L', (0.055, 0.012, 0.012), (0.12, -0.195, 1.605), materials['MAT_Gem_Cyan']))
    add(add_cube('CH_Vex_Eye_Glow_R', (0.055, 0.012, 0.012), (0.12, 0.195, 1.605), materials['MAT_Gem_Cyan']))
    add(add_cone_between('CH_Vex_Hood_BackPoint', (-0.10, 0, 1.63), (-0.34, 0, 1.72), 0.11, materials['MAT_Dark_Navy'], 5))
    add(add_cone_between('CH_Vex_Hood_Ear_L', (0.0, -0.08, 1.72), (-0.025, -0.12, 1.91), 0.055, materials['MAT_Dark_Navy'], 4))
    add(add_cone_between('CH_Vex_Hood_Ear_R', (0.0, 0.08, 1.72), (-0.025, 0.12, 1.91), 0.055, materials['MAT_Dark_Navy'], 4))

    for side, ysign in [('L', -1), ('R', 1)]:
        shoulder = (0.0, 0.22 * ysign, 1.33)
        elbow = (-0.03, 0.27 * ysign, 1.05)
        wrist = (0.04, 0.24 * ysign, 0.82)
        add(add_cylinder_between(f'CH_Vex_UpperArm_{side}', shoulder, elbow, 0.045, materials['MAT_Dark_Navy'], 6))
        add(add_cylinder_between(f'CH_Vex_Forearm_{side}', elbow, wrist, 0.04, materials['MAT_Deep_Purple'], 6))
        add(add_ico_sphere(f'CH_Vex_Glove_{side}', (0.055, 0.045, 0.055), wrist, materials['MAT_Charcoal'], 1))

    for side, ysign in [('L', -1), ('R', 1)]:
        hip = (0.0, 0.095 * ysign, 0.78)
        knee = (0.02, 0.095 * ysign, 0.43)
        ankle = (0.0, 0.095 * ysign, 0.16)
        add(add_cylinder_between(f'CH_Vex_UpperLeg_{side}', hip, knee, 0.055, materials['MAT_Deep_Purple'], 6))
        add(add_cylinder_between(f'CH_Vex_LowerLeg_{side}', knee, ankle, 0.048, materials['MAT_Dark_Navy'], 6))
        add(add_cube(f'CH_Vex_Shoe_{side}', (0.30, 0.11, 0.105), (0.075, 0.095 * ysign, 0.055), materials['MAT_Charcoal']))
        add(add_cube(f'CH_Vex_Sole_{side}', (0.31, 0.115, 0.025), (0.085, 0.095 * ysign, 0.015), materials['MAT_Sole_Light']))

    add(add_prism_between('CH_Vex_Diagonal_Strap_CameraSide', (0.10, -0.255, 1.42), (-0.07, -0.255, 0.94), 0.035, 0.025, materials['MAT_Gold_Accent']))
    add(add_prism_between('CH_Vex_Diagonal_Strap_FarSide', (0.10, 0.255, 1.42), (-0.07, 0.255, 0.94), 0.025, 0.018, materials['MAT_Gold_Accent']))
    add(add_cube('CH_Vex_Satchel_CameraSide', (0.15, 0.07, 0.20), (-0.04, -0.275, 0.82), materials['MAT_Warm_Brown']))
    add(add_cube('CH_Vex_Satchel_Flap', (0.155, 0.075, 0.045), (-0.035, -0.315, 0.91), materials['MAT_Gold_Accent']))
    add(add_diamond('CH_Vex_GemClasp_Chest', (0.105, -0.275, 1.18), 0.045, 0.065, materials['MAT_Gem_Cyan']))
    add(add_diamond('CH_Vex_GemClasp_Belt', (0.08, -0.235, 0.94), 0.035, 0.045, materials['MAT_Gem_Cyan']))

    scarf_points = [
        (-0.08, -0.09, 1.42),
        (-0.25, -0.12, 1.39),
        (-0.43, -0.13, 1.32),
        (-0.59, -0.12, 1.24),
        (-0.73, -0.10, 1.17),
        (-0.83, -0.08, 1.10),
    ]
    for i in range(len(scarf_points) - 1):
        thick = max(0.055 - i * 0.006, 0.025)
        add(add_prism_between(f'CH_Vex_Scarf_Segment_{i+1:02d}', scarf_points[i], scarf_points[i + 1], thick, 0.018, materials['MAT_Teal_Accent']))

    add(add_cube('CH_Vex_Ground_Reference_DeleteMe', (1.20, 0.02, 0.01), (0.0, 0.38, 0.005), materials['MAT_Sole_Light']))

    return objects


def create_armature() -> bpy.types.Object:
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    arm = bpy.context.object
    arm.name = 'RIG_Vex_Armature'
    arm.data.name = 'RIG_Vex_Skeleton'
    arm.show_in_front = True

    eb = arm.data.edit_bones
    default = eb.get('Bone')
    if default:
        eb.remove(default)

    bones = {}

    def bone(name: str, head, tail, parent: str | None = None):
        b = eb.new(name)
        b.head = head
        b.tail = tail
        if parent:
            b.parent = bones[parent]
            b.use_connect = False
        bones[name] = b
        return b

    bone('Root', (0, 0, 0.00), (0, 0, 0.12))
    bone('Pelvis', (0, 0, 0.72), (0, 0, 0.95), 'Root')
    bone('Spine_01', (0, 0, 0.95), (0, 0, 1.13), 'Pelvis')
    bone('Spine_02', (0, 0, 1.13), (0, 0, 1.31), 'Spine_01')
    bone('Chest', (0, 0, 1.31), (0, 0, 1.45), 'Spine_02')
    bone('Neck', (0, 0, 1.45), (0, 0, 1.53), 'Chest')
    bone('Head', (0, 0, 1.53), (0, 0, 1.75), 'Neck')

    for side, ysign in [('L', -1), ('R', 1)]:
        bone(f'UpperArm_{side}', (0.0, 0.22 * ysign, 1.33), (-0.03, 0.27 * ysign, 1.05), 'Chest')
        bone(f'LowerArm_{side}', (-0.03, 0.27 * ysign, 1.05), (0.04, 0.24 * ysign, 0.82), f'UpperArm_{side}')
        bone(f'Hand_{side}', (0.04, 0.24 * ysign, 0.82), (0.07, 0.24 * ysign, 0.74), f'LowerArm_{side}')

    for side, ysign in [('L', -1), ('R', 1)]:
        bone(f'UpperLeg_{side}', (0.0, 0.095 * ysign, 0.78), (0.02, 0.095 * ysign, 0.43), 'Pelvis')
        bone(f'LowerLeg_{side}', (0.02, 0.095 * ysign, 0.43), (0.0, 0.095 * ysign, 0.16), f'UpperLeg_{side}')
        bone(f'Foot_{side}', (0.0, 0.095 * ysign, 0.16), (0.20, 0.095 * ysign, 0.055), f'LowerLeg_{side}')
        bone(f'Toe_{side}', (0.20, 0.095 * ysign, 0.055), (0.31, 0.095 * ysign, 0.055), f'Foot_{side}')

    scarf_points = [
        (-0.08, -0.09, 1.42),
        (-0.25, -0.12, 1.39),
        (-0.43, -0.13, 1.32),
        (-0.59, -0.12, 1.24),
        (-0.73, -0.10, 1.17),
        (-0.83, -0.08, 1.10),
    ]
    parent = 'Chest'
    for i in range(len(scarf_points) - 1):
        name = f'Scarf_{i+1:02d}'
        bone(name, scarf_points[i], scarf_points[i + 1], parent)
        parent = name

    bone('Satchel', (-0.04, -0.275, 0.92), (-0.04, -0.275, 0.74), 'Pelvis')
    bone('HoodTip', (-0.10, 0, 1.63), (-0.34, 0, 1.72), 'Head')

    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
    return arm


def parent_to_bone(obj: bpy.types.Object, arm: bpy.types.Object, bone_name: str) -> None:
    world = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = 'BONE'
    obj.parent_bone = bone_name
    obj.matrix_world = world


def parent_meshes_to_rig(objects: Dict[str, bpy.types.Object], arm: bpy.types.Object) -> None:
    mapping = {
        'CH_Vex_Torso_Undersuit': 'Spine_02',
        'CH_Vex_Cropped_Jacket': 'Chest',
        'CH_Vex_Pelvis': 'Pelvis',
        'CH_Vex_Belt': 'Pelvis',
        'CH_Vex_GemClasp_Belt': 'Pelvis',
        'CH_Vex_GemClasp_Chest': 'Chest',
        'CH_Vex_Diagonal_Strap_CameraSide': 'Chest',
        'CH_Vex_Diagonal_Strap_FarSide': 'Chest',
        'CH_Vex_Satchel_CameraSide': 'Satchel',
        'CH_Vex_Satchel_Flap': 'Satchel',
        'CH_Vex_Head_DarkFace': 'Head',
        'CH_Vex_Hood_Cowl': 'Head',
        'CH_Vex_Mask_SidePanel_L': 'Head',
        'CH_Vex_Mask_SidePanel_R': 'Head',
        'CH_Vex_Eye_Glow_L': 'Head',
        'CH_Vex_Eye_Glow_R': 'Head',
        'CH_Vex_Hood_BackPoint': 'HoodTip',
        'CH_Vex_Hood_Ear_L': 'Head',
        'CH_Vex_Hood_Ear_R': 'Head',
    }
    for side in ['L', 'R']:
        mapping[f'CH_Vex_UpperArm_{side}'] = f'UpperArm_{side}'
        mapping[f'CH_Vex_Forearm_{side}'] = f'LowerArm_{side}'
        mapping[f'CH_Vex_Glove_{side}'] = f'Hand_{side}'
        mapping[f'CH_Vex_UpperLeg_{side}'] = f'UpperLeg_{side}'
        mapping[f'CH_Vex_LowerLeg_{side}'] = f'LowerLeg_{side}'
        mapping[f'CH_Vex_Shoe_{side}'] = f'Foot_{side}'
        mapping[f'CH_Vex_Sole_{side}'] = f'Foot_{side}'
    for i in range(1, 6):
        mapping[f'CH_Vex_Scarf_Segment_{i:02d}'] = f'Scarf_{i:02d}'

    for obj_name, bone_name in mapping.items():
        obj = objects.get(obj_name)
        if obj and bone_name in arm.data.bones:
            parent_to_bone(obj, arm, bone_name)


def reset_pose(arm: bpy.types.Object) -> None:
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)


def key_pose(arm: bpy.types.Object, frame: int, bone_values: Dict[str, Dict[str, Tuple[float, float, float]]]) -> None:
    bpy.context.scene.frame_set(frame)
    for bone_name, values in bone_values.items():
        pb = arm.pose.bones.get(bone_name)
        if not pb:
            continue
        if 'loc' in values:
            pb.location = values['loc']
            pb.keyframe_insert(data_path='location', frame=frame)
        if 'rot' in values:
            pb.rotation_mode = 'XYZ'
            pb.rotation_euler = tuple(deg(v) for v in values['rot'])
            pb.keyframe_insert(data_path='rotation_euler', frame=frame)
        if 'scale' in values:
            pb.scale = values['scale']
            pb.keyframe_insert(data_path='scale', frame=frame)


def make_action(arm: bpy.types.Object, name: str, frame_start: int, frame_end: int, keyframes, loop: bool = False) -> bpy.types.Action:
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='POSE')
    reset_pose(arm)
    arm.animation_data_create()
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    arm.animation_data.action = action
    for frame, values in keyframes:
        key_pose(arm, frame, values)
    # Make curves clearer for game-style placeholders.
    for fc in action.fcurves:
        if loop:
            fc.modifiers.new(type='CYCLES')
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR' if loop else 'BEZIER'
    bpy.ops.object.mode_set(mode='OBJECT')
    return action


def create_animation_actions(arm: bpy.types.Object) -> None:
    # Idle loop: small breathing and scarf drift.
    make_action(arm, 'ACT_Vex_Idle_60f_loop', 1, 60, [
        (1, {'Pelvis': {'loc': (0, 0, 0)}, 'Chest': {'rot': (0, 0, 0)}, 'Head': {'rot': (0, 0, 0)}, 'Scarf_02': {'rot': (0, 0, 0)}, 'Scarf_04': {'rot': (0, 0, 0)}}),
        (30, {'Pelvis': {'loc': (0, 0, 0.012)}, 'Chest': {'rot': (1.5, -1, 0)}, 'Head': {'rot': (-1, 1, 0)}, 'Scarf_02': {'rot': (0, 0, 5)}, 'Scarf_04': {'rot': (0, 0, -4)}}),
        (60, {'Pelvis': {'loc': (0, 0, 0)}, 'Chest': {'rot': (0, 0, 0)}, 'Head': {'rot': (0, 0, 0)}, 'Scarf_02': {'rot': (0, 0, 0)}, 'Scarf_04': {'rot': (0, 0, 0)}}),
    ], loop=True)

    # Run loop: snappy readable placeholder, in-place, +X direction.
    make_action(arm, 'ACT_Vex_Run_20f_loop_in_place', 1, 20, [
        (1, {
            'Pelvis': {'loc': (0, 0, 0.015), 'rot': (0, -5, 0)}, 'Chest': {'rot': (0, -12, 0)}, 'Head': {'rot': (0, 8, 0)},
            'UpperLeg_L': {'rot': (0, -34, 0)}, 'LowerLeg_L': {'rot': (0, 38, 0)}, 'Foot_L': {'rot': (0, -10, 0)},
            'UpperLeg_R': {'rot': (0, 30, 0)}, 'LowerLeg_R': {'rot': (0, 8, 0)}, 'Foot_R': {'rot': (0, 12, 0)},
            'UpperArm_L': {'rot': (0, 28, 0)}, 'LowerArm_L': {'rot': (0, -28, 0)},
            'UpperArm_R': {'rot': (0, -34, 0)}, 'LowerArm_R': {'rot': (0, -20, 0)},
            'Scarf_01': {'rot': (0, 0, -8)}, 'Scarf_03': {'rot': (0, 0, 10)}, 'Scarf_05': {'rot': (0, 0, 15)},
        }),
        (6, {'Pelvis': {'loc': (0, 0, 0.045)}}),
        (11, {
            'Pelvis': {'loc': (0, 0, 0.015), 'rot': (0, -5, 0)}, 'Chest': {'rot': (0, -12, 0)}, 'Head': {'rot': (0, 8, 0)},
            'UpperLeg_L': {'rot': (0, 30, 0)}, 'LowerLeg_L': {'rot': (0, 8, 0)}, 'Foot_L': {'rot': (0, 12, 0)},
            'UpperLeg_R': {'rot': (0, -34, 0)}, 'LowerLeg_R': {'rot': (0, 38, 0)}, 'Foot_R': {'rot': (0, -10, 0)},
            'UpperArm_L': {'rot': (0, -34, 0)}, 'LowerArm_L': {'rot': (0, -20, 0)},
            'UpperArm_R': {'rot': (0, 28, 0)}, 'LowerArm_R': {'rot': (0, -28, 0)},
            'Scarf_01': {'rot': (0, 0, 8)}, 'Scarf_03': {'rot': (0, 0, -10)}, 'Scarf_05': {'rot': (0, 0, -15)},
        }),
        (16, {'Pelvis': {'loc': (0, 0, 0.045)}}),
        (20, {
            'Pelvis': {'loc': (0, 0, 0.015), 'rot': (0, -5, 0)}, 'Chest': {'rot': (0, -12, 0)}, 'Head': {'rot': (0, 8, 0)},
            'UpperLeg_L': {'rot': (0, -34, 0)}, 'LowerLeg_L': {'rot': (0, 38, 0)}, 'Foot_L': {'rot': (0, -10, 0)},
            'UpperLeg_R': {'rot': (0, 30, 0)}, 'LowerLeg_R': {'rot': (0, 8, 0)}, 'Foot_R': {'rot': (0, 12, 0)},
            'UpperArm_L': {'rot': (0, 28, 0)}, 'LowerArm_L': {'rot': (0, -28, 0)},
            'UpperArm_R': {'rot': (0, -34, 0)}, 'LowerArm_R': {'rot': (0, -20, 0)},
            'Scarf_01': {'rot': (0, 0, -8)}, 'Scarf_03': {'rot': (0, 0, 10)}, 'Scarf_05': {'rot': (0, 0, 15)},
        }),
    ], loop=True)

    make_action(arm, 'ACT_Vex_JumpStart_08f', 1, 8, [
        (1, {'Pelvis': {'loc': (0, 0, -0.055)}, 'Chest': {'rot': (0, -10, 0)}, 'UpperLeg_L': {'rot': (0, 28, 0)}, 'UpperLeg_R': {'rot': (0, 28, 0)}, 'LowerLeg_L': {'rot': (0, -38, 0)}, 'LowerLeg_R': {'rot': (0, -38, 0)}, 'UpperArm_L': {'rot': (0, -32, 0)}, 'UpperArm_R': {'rot': (0, -32, 0)}}),
        (8, {'Pelvis': {'loc': (0, 0, 0.075)}, 'Chest': {'rot': (0, 8, 0)}, 'UpperLeg_L': {'rot': (0, -12, 0)}, 'UpperLeg_R': {'rot': (0, -12, 0)}, 'LowerLeg_L': {'rot': (0, 12, 0)}, 'LowerLeg_R': {'rot': (0, 12, 0)}, 'UpperArm_L': {'rot': (0, 42, 0)}, 'UpperArm_R': {'rot': (0, 42, 0)}, 'Scarf_03': {'rot': (0, 0, 14)}}),
    ])

    make_action(arm, 'ACT_Vex_JumpRise_16f_hold', 1, 16, [
        (1, {'Pelvis': {'loc': (0, 0, 0.06)}, 'Chest': {'rot': (0, 5, 0)}, 'UpperLeg_L': {'rot': (0, -8, 0)}, 'UpperLeg_R': {'rot': (0, -18, 0)}, 'LowerLeg_L': {'rot': (0, 25, 0)}, 'LowerLeg_R': {'rot': (0, 34, 0)}, 'UpperArm_L': {'rot': (0, 48, 0)}, 'UpperArm_R': {'rot': (0, 35, 0)}, 'Scarf_01': {'rot': (0, 0, 12)}, 'Scarf_04': {'rot': (0, 0, 25)}}),
        (16, {'Pelvis': {'loc': (0, 0, 0.07)}, 'Chest': {'rot': (0, 3, 0)}, 'Head': {'rot': (0, 3, 0)}, 'Scarf_01': {'rot': (0, 0, 18)}, 'Scarf_04': {'rot': (0, 0, 20)}}),
    ])

    make_action(arm, 'ACT_Vex_FallLoop_16f_loop', 1, 16, [
        (1, {'Pelvis': {'loc': (0, 0, 0.0)}, 'Chest': {'rot': (0, -6, 0)}, 'UpperLeg_L': {'rot': (0, 12, 0)}, 'UpperLeg_R': {'rot': (0, -8, 0)}, 'LowerLeg_L': {'rot': (0, 25, 0)}, 'LowerLeg_R': {'rot': (0, 10, 0)}, 'UpperArm_L': {'rot': (0, 20, 15)}, 'UpperArm_R': {'rot': (0, 12, -15)}, 'Scarf_02': {'rot': (0, 0, 24)}, 'Scarf_05': {'rot': (0, 0, 34)}}),
        (8, {'Chest': {'rot': (0, -3, 0)}, 'Head': {'rot': (0, -3, 0)}, 'Scarf_02': {'rot': (0, 0, 12)}, 'Scarf_05': {'rot': (0, 0, 22)}}),
        (16, {'Pelvis': {'loc': (0, 0, 0.0)}, 'Chest': {'rot': (0, -6, 0)}, 'UpperLeg_L': {'rot': (0, 12, 0)}, 'UpperLeg_R': {'rot': (0, -8, 0)}, 'LowerLeg_L': {'rot': (0, 25, 0)}, 'LowerLeg_R': {'rot': (0, 10, 0)}, 'UpperArm_L': {'rot': (0, 20, 15)}, 'UpperArm_R': {'rot': (0, 12, -15)}, 'Scarf_02': {'rot': (0, 0, 24)}, 'Scarf_05': {'rot': (0, 0, 34)}}),
    ], loop=True)

    make_action(arm, 'ACT_Vex_LandLight_10f', 1, 10, [
        (1, {'Pelvis': {'loc': (0, 0, -0.07)}, 'Chest': {'rot': (0, -14, 0)}, 'UpperLeg_L': {'rot': (0, 32, 0)}, 'UpperLeg_R': {'rot': (0, 32, 0)}, 'LowerLeg_L': {'rot': (0, -42, 0)}, 'LowerLeg_R': {'rot': (0, -42, 0)}, 'UpperArm_L': {'rot': (0, -18, 0)}, 'UpperArm_R': {'rot': (0, -18, 0)}, 'Scarf_03': {'rot': (0, 0, 18)}}),
        (10, {'Pelvis': {'loc': (0, 0, 0.0)}, 'Chest': {'rot': (0, -4, 0)}, 'UpperLeg_L': {'rot': (0, 0, 0)}, 'UpperLeg_R': {'rot': (0, 0, 0)}, 'LowerLeg_L': {'rot': (0, 0, 0)}, 'LowerLeg_R': {'rot': (0, 0, 0)}, 'Scarf_03': {'rot': (0, 0, 0)}}),
    ])

    make_action(arm, 'ACT_Vex_VaultLow_24f', 1, 24, [
        (1, {'Chest': {'rot': (0, -12, 0)}, 'UpperArm_L': {'rot': (0, 55, 0)}, 'UpperArm_R': {'rot': (0, 55, 0)}, 'LowerArm_L': {'rot': (0, -18, 0)}, 'LowerArm_R': {'rot': (0, -18, 0)}}),
        (12, {'Pelvis': {'loc': (0, 0, 0.16), 'rot': (0, -8, 0)}, 'Chest': {'rot': (0, -25, 0)}, 'UpperLeg_L': {'rot': (0, 58, 0)}, 'UpperLeg_R': {'rot': (0, 52, 0)}, 'LowerLeg_L': {'rot': (0, -70, 0)}, 'LowerLeg_R': {'rot': (0, -60, 0)}, 'UpperArm_L': {'rot': (0, 70, 0)}, 'UpperArm_R': {'rot': (0, 70, 0)}, 'Scarf_04': {'rot': (0, 0, 20)}}),
        (24, {'Pelvis': {'loc': (0, 0, 0.0)}, 'Chest': {'rot': (0, -8, 0)}, 'UpperLeg_L': {'rot': (0, -10, 0)}, 'UpperLeg_R': {'rot': (0, 6, 0)}, 'LowerLeg_L': {'rot': (0, 18, 0)}, 'LowerLeg_R': {'rot': (0, 10, 0)}, 'UpperArm_L': {'rot': (0, -20, 0)}, 'UpperArm_R': {'rot': (0, -16, 0)}, 'Scarf_04': {'rot': (0, 0, 0)}}),
    ])

    make_action(arm, 'ACT_Vex_Trip_30f', 1, 30, [
        (1, {'Pelvis': {'rot': (0, -8, 0)}, 'Chest': {'rot': (0, -8, 0)}}),
        (12, {'Pelvis': {'loc': (0.04, 0, -0.02), 'rot': (0, -24, 0)}, 'Chest': {'rot': (0, -38, 0)}, 'Head': {'rot': (0, 22, 0)}, 'UpperArm_L': {'rot': (0, 70, 25)}, 'UpperArm_R': {'rot': (0, 35, -30)}, 'UpperLeg_L': {'rot': (0, 34, 0)}, 'LowerLeg_L': {'rot': (0, -55, 0)}, 'Scarf_05': {'rot': (0, 0, 42)}}),
        (30, {'Pelvis': {'loc': (0, 0, -0.06), 'rot': (0, -12, 0)}, 'Chest': {'rot': (0, -20, 0)}, 'Head': {'rot': (0, 10, 0)}, 'UpperArm_L': {'rot': (0, 25, 0)}, 'UpperArm_R': {'rot': (0, 25, 0)}, 'Scarf_05': {'rot': (0, 0, 18)}}),
    ])

    make_action(arm, 'ACT_Vex_FrontFlip_30f', 1, 30, [
        (1, {'Root': {'rot': (0, 0, 0)}, 'Pelvis': {'loc': (0, 0, 0.12)}, 'Chest': {'rot': (0, -10, 0)}, 'UpperLeg_L': {'rot': (0, 18, 0)}, 'UpperLeg_R': {'rot': (0, 18, 0)}, 'LowerLeg_L': {'rot': (0, -42, 0)}, 'LowerLeg_R': {'rot': (0, -42, 0)}}),
        (15, {'Root': {'rot': (0, -180, 0)}, 'Pelvis': {'loc': (0, 0, 0.20)}, 'Chest': {'rot': (0, -28, 0)}, 'Head': {'rot': (0, 10, 0)}, 'Scarf_04': {'rot': (0, 0, 35)}}),
        (30, {'Root': {'rot': (0, -360, 0)}, 'Pelvis': {'loc': (0, 0, 0.06)}, 'Chest': {'rot': (0, -6, 0)}, 'UpperLeg_L': {'rot': (0, 0, 0)}, 'UpperLeg_R': {'rot': (0, 0, 0)}, 'LowerLeg_L': {'rot': (0, 0, 0)}, 'LowerLeg_R': {'rot': (0, 0, 0)}, 'Scarf_04': {'rot': (0, 0, 12)}}),
    ])

    make_action(arm, 'ACT_Vex_RollLanding_28f', 1, 28, [
        (1, {'Pelvis': {'loc': (0, 0, -0.03)}, 'Chest': {'rot': (0, -35, 0)}, 'Head': {'rot': (0, 25, 0)}, 'UpperLeg_L': {'rot': (0, 48, 0)}, 'UpperLeg_R': {'rot': (0, 48, 0)}, 'LowerLeg_L': {'rot': (0, -72, 0)}, 'LowerLeg_R': {'rot': (0, -72, 0)}}),
        (14, {'Root': {'rot': (0, -170, 0)}, 'Pelvis': {'loc': (0, 0, 0.02)}, 'Chest': {'rot': (0, -65, 0)}, 'Scarf_03': {'rot': (0, 0, 40)}}),
        (28, {'Root': {'rot': (0, -360, 0)}, 'Pelvis': {'loc': (0, 0, 0.0)}, 'Chest': {'rot': (0, -6, 0)}, 'Head': {'rot': (0, 0, 0)}, 'UpperLeg_L': {'rot': (0, 0, 0)}, 'UpperLeg_R': {'rot': (0, 0, 0)}, 'LowerLeg_L': {'rot': (0, 0, 0)}, 'LowerLeg_R': {'rot': (0, 0, 0)}, 'Scarf_03': {'rot': (0, 0, 10)}}),
    ])

    reset_pose(arm)
    arm.animation_data.action = bpy.data.actions.get('ACT_Vex_Idle_60f_loop')
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 60


def add_readme_text() -> None:
    text = bpy.data.texts.new('README_Vex_Blockout')
    text.write(
        "Vex Vale / The Facet Fox — greybox asset\n"
        "\n"
        "Purpose: first playable-scale low-poly blockout for a side-on 3D city freerunning game.\n"
        "Orientation: Z-up, +X forward/right, Y depth/camera side.\n"
        "Rig style: rigid body-part parenting to bones. Replace with skinned mesh after gameplay approval.\n"
        "\n"
        "Included placeholder Actions:\n"
        "- ACT_Vex_Idle_60f_loop\n"
        "- ACT_Vex_Run_20f_loop_in_place\n"
        "- ACT_Vex_JumpStart_08f\n"
        "- ACT_Vex_JumpRise_16f_hold\n"
        "- ACT_Vex_FallLoop_16f_loop\n"
        "- ACT_Vex_LandLight_10f\n"
        "- ACT_Vex_VaultLow_24f\n"
        "- ACT_Vex_Trip_30f\n"
        "- ACT_Vex_FrontFlip_30f\n"
        "- ACT_Vex_RollLanding_28f\n"
        "\n"
        "Design notes: dark navy/purple outfit, teal scarf, gold strap/belt, cyan gem accents, pointed hood, side satchel, chunky shoes.\n"
        "Delete CH_Vex_Ground_Reference_DeleteMe before final export if you do not want the scale marker.\n"
    )


def setup_camera_and_light() -> None:
    bpy.ops.object.light_add(type='AREA', location=(-2.5, -4.0, 4.0))
    light = bpy.context.object
    light.name = 'LIGHT_Key_Area'
    light.data.energy = 400
    light.data.size = 4

    bpy.ops.object.camera_add(location=(0.35, -5.0, 1.1), rotation=(deg(78), 0, deg(4)))
    cam = bpy.context.object
    cam.name = 'CAM_SidePreview'
    bpy.context.scene.camera = cam
    try:
        cam.data.lens = 55
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = 2.3
    except Exception:
        pass


def output_dir() -> Path:
    try:
        return Path(__file__).resolve().parent
    except Exception:
        return Path(bpy.path.abspath('//')).resolve()


def main() -> None:
    clean_scene()
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.render.fps = 30

    materials = make_materials()
    objects = build_meshes(materials)
    arm = create_armature()
    parent_meshes_to_rig(objects, arm)
    create_animation_actions(arm)
    add_readme_text()
    setup_camera_and_light()

    # Put collections/names into a clean state.
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm

    out = output_dir()
    if SAVE_BLEND_ON_RUN:
        bpy.ops.wm.save_as_mainfile(filepath=str(out / 'vex_vale_rigged_blockout.blend'))
    if EXPORT_FBX_ON_RUN:
        bpy.ops.export_scene.fbx(
            filepath=str(out / 'vex_vale_rigged_blockout.fbx'),
            use_selection=False,
            add_leaf_bones=False,
            bake_anim=True,
            bake_anim_use_all_actions=True,
            object_types={'ARMATURE', 'MESH'},
        )

    print('Created Vex Vale low-poly rigged greybox with placeholder Actions.')


if __name__ == '__main__':
    main()
