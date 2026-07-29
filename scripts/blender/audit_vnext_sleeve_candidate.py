import bpy


scene = bpy.context.scene
rig = bpy.data.objects['GS_FieldPlayer_Rig']
rig.animation_data_create()
rig.animation_data.action = bpy.data.actions['jog-to-sprint-ik']
scene.frame_set(4)
depsgraph = bpy.context.evaluated_depsgraph_get()

for name in (
    'GS_Home_Jersey',
    'GS_Home_Jersey_Sleeve_Left',
    'GS_Home_Jersey_Sleeve_Right',
    'GS_Home_Jersey_Sleeve_Stripe_Left',
    'GS_Home_Jersey_Sleeve_Stripe_Right',
    'GS_Away_Jersey',
    'GS_Away_Jersey_Front_Mark',
    'GS_Away_Jersey_Back_Number_17',
    'GS_Away_Jersey_Back_Number_17_Outline',
):
    obj = bpy.data.objects.get(name)
    if obj is None:
        print('SLEEVE_AUDIT_MISSING', name)
        continue
    evaluated = obj.evaluated_get(depsgraph)
    points = [evaluated.matrix_world @ vertex.co for vertex in evaluated.data.vertices]
    minimum = tuple(round(min(point[axis] for point in points), 3) for axis in range(3))
    maximum = tuple(round(max(point[axis] for point in points), 3) for axis in range(3))
    print(
        'SLEEVE_AUDIT',
        name,
        'collections',
        [collection.name for collection in obj.users_collection],
        'hide',
        obj.hide_render,
        'bounds',
        minimum,
        maximum,
        'vertices',
        len(evaluated.data.vertices),
        'modifiers',
        [modifier.type for modifier in obj.modifiers],
        'parent',
        obj.parent.name if obj.parent else None,
        'parentType',
        obj.parent_type,
        'parentBone',
        obj.parent_bone,
        'location',
        tuple(round(value, 4) for value in obj.location),
        'rotation',
        tuple(round(value, 4) for value in obj.rotation_euler),
    )
