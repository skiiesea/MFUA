extends Node3D

const TREE_SEED: int = 4102026

var ground_material: StandardMaterial3D
var path_material: StandardMaterial3D
var station_wall_material: StandardMaterial3D
var station_roof_material: StandardMaterial3D
var window_material: StandardMaterial3D
var trunk_material: StandardMaterial3D
var rock_material: StandardMaterial3D


func _ready() -> void:
	_create_materials()
	_create_environment()
	_create_ground()
	_create_path()
	_create_forest()
	_create_hills()
	_create_station()
	_create_rocks()
	_create_pickups()


func _create_materials() -> void:
	ground_material = _make_material(Color(0.19, 0.25, 0.19))
	path_material = _make_material(Color(0.36, 0.31, 0.23))
	station_wall_material = _make_material(Color(0.36, 0.42, 0.38))
	station_roof_material = _make_material(Color(0.19, 0.24, 0.25))
	window_material = _make_material(Color(0.08, 0.16, 0.18), 0.35)
	trunk_material = _make_material(Color(0.25, 0.16, 0.10))
	rock_material = _make_material(Color(0.34, 0.38, 0.36))


func _make_material(color: Color, roughness: float = 0.92) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	return material


func _create_environment() -> void:
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color(0.34, 0.48, 0.52)
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.57, 0.64, 0.62)
	environment.ambient_light_energy = 0.72
	environment.fog_enabled = true
	environment.fog_light_color = Color(0.48, 0.59, 0.58)
	environment.fog_density = 0.006

	var world_environment := WorldEnvironment.new()
	world_environment.environment = environment
	add_child(world_environment)

	var sun := DirectionalLight3D.new()
	sun.name = "LateAfternoonSun"
	sun.rotation = Vector3(deg_to_rad(-38.0), deg_to_rad(-28.0), 0.0)
	sun.light_color = Color(1.0, 0.86, 0.69)
	sun.light_energy = 1.15
	sun.shadow_enabled = true
	add_child(sun)


func _create_ground() -> void:
	_add_box(
		self,
		"ValleyGround",
		Vector3(120.0, 0.2, 120.0),
		Vector3(0.0, -0.1, 0.0),
		ground_material,
		true
	)


func _create_path() -> void:
	_add_box(
		self,
		"OldServiceTrack",
		Vector3(4.2, 0.025, 31.0),
		Vector3(0.0, 0.018, -5.5),
		path_material
	)

	var water_material := _make_material(Color(0.13, 0.28, 0.30), 0.28)
	var water_mesh := PlaneMesh.new()
	water_mesh.size = Vector2(15.0, 9.0)
	var water := MeshInstance3D.new()
	water.name = "StillWater"
	water.mesh = water_mesh
	water.material_override = water_material
	water.position = Vector3(22.0, 0.025, -23.0)
	add_child(water)


func _create_forest() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = TREE_SEED
	var tree_positions: Array[Vector3] = []

	for row in range(-7, 8):
		for column in range(-7, 8):
			var x := float(column) * 8.0 + rng.randf_range(-2.2, 2.2)
			var z := float(row) * 8.0 + rng.randf_range(-2.2, 2.2)
			if Vector2(x, z).length() < 17.0:
				continue
			if absf(x) < 5.5 and z > -30.0 and z < 13.0:
				continue
			tree_positions.append(Vector3(x, 0.0, z))

	var trunk_mesh := CylinderMesh.new()
	trunk_mesh.top_radius = 0.13
	trunk_mesh.bottom_radius = 0.19
	trunk_mesh.height = 2.6
	trunk_mesh.radial_segments = 6

	var canopy_mesh := ConeMesh.new()
	canopy_mesh.radius = 1.25
	canopy_mesh.height = 3.8
	canopy_mesh.radial_segments = 7

	var foliage_material := StandardMaterial3D.new()
	foliage_material.albedo_color = Color.WHITE
	foliage_material.vertex_color_use_as_albedo = true
	foliage_material.roughness = 1.0

	var trunks := MultiMesh.new()
	trunks.transform_format = MultiMesh.TRANSFORM_3D
	trunks.mesh = trunk_mesh
	trunks.instance_count = tree_positions.size()

	var foliage := MultiMesh.new()
	foliage.transform_format = MultiMesh.TRANSFORM_3D
	foliage.use_colors = true
	foliage.mesh = canopy_mesh
	foliage.instance_count = tree_positions.size()

	var canopy_colors: Array[Color] = [
		Color(0.19, 0.31, 0.25),
		Color(0.23, 0.36, 0.28),
		Color(0.27, 0.39, 0.30),
		Color(0.16, 0.28, 0.24)
	]

	for index in range(tree_positions.size()):
		var position := tree_positions[index]
		var scale_factor := rng.randf_range(0.82, 1.22)
		var scaled_basis := Basis().scaled(Vector3.ONE * scale_factor)
		trunks.set_instance_transform(
			index,
			Transform3D(scaled_basis, Vector3(position.x, 1.3 * scale_factor, position.z))
		)
		foliage.set_instance_transform(
			index,
			Transform3D(scaled_basis, Vector3(position.x, 3.25 * scale_factor, position.z))
		)
		foliage.set_instance_color(index, canopy_colors[rng.randi_range(0, canopy_colors.size() - 1)])

		if Vector2(position.x, position.z).length() < 42.0:
			var tree_collision := StaticBody3D.new()
			tree_collision.name = "TreeTrunkCollision"
			tree_collision.position = Vector3(position.x, 1.25 * scale_factor, position.z)
			var collision_shape := CollisionShape3D.new()
			var cylinder_shape := CylinderShape3D.new()
			cylinder_shape.radius = 0.2 * scale_factor
			cylinder_shape.height = 2.5 * scale_factor
			collision_shape.shape = cylinder_shape
			tree_collision.add_child(collision_shape)
			add_child(tree_collision)

	var trunk_instance := MultiMeshInstance3D.new()
	trunk_instance.name = "ForestTrunks"
	trunk_instance.multimesh = trunks
	trunk_instance.material_override = trunk_material
	trunk_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(trunk_instance)

	var foliage_instance := MultiMeshInstance3D.new()
	foliage_instance.name = "ForestCanopies"
	foliage_instance.multimesh = foliage
	foliage_instance.material_override = foliage_material
	foliage_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(foliage_instance)


func _create_hills() -> void:
	var hill_material := _make_material(Color(0.25, 0.34, 0.29))
	var hill_positions: Array[Vector3] = [
		Vector3(-52.0, 3.0, -42.0),
		Vector3(-43.0, 2.0, 35.0),
		Vector3(49.0, 4.0, -38.0),
		Vector3(53.0, 3.0, 29.0),
		Vector3(-18.0, 2.0, 55.0),
		Vector3(18.0, 2.0, -55.0)
	]
	var hill_scales: Array[Vector3] = [
		Vector3(22.0, 8.0, 18.0),
		Vector3(19.0, 7.0, 15.0),
		Vector3(24.0, 10.0, 19.0),
		Vector3(18.0, 7.0, 17.0),
		Vector3(25.0, 8.0, 14.0),
		Vector3(23.0, 9.0, 16.0)
	]

	for index in range(hill_positions.size()):
		var hill_mesh := SphereMesh.new()
		hill_mesh.radial_segments = 12
		hill_mesh.rings = 6
		var hill := MeshInstance3D.new()
		hill.name = "DistantHill_%02d" % index
		hill.mesh = hill_mesh
		hill.material_override = hill_material
		hill.position = hill_positions[index]
		hill.scale = hill_scales[index]
		add_child(hill)


func _create_station() -> void:
	var station := Node3D.new()
	station.name = "MeteorologicalStation"
	station.position = Vector3(0.0, 0.0, -19.0)
	add_child(station)

	var foundation_material := _make_material(Color(0.25, 0.27, 0.25))
	var trim_material := _make_material(Color(0.18, 0.22, 0.21))
	var lamp_material := _make_material(Color(0.78, 0.48, 0.19), 0.35)

	_add_box(station, "Foundation", Vector3(6.4, 0.3, 5.4), Vector3(0.0, 0.15, 0.0), foundation_material, false)
	_add_box(station, "BackWall", Vector3(6.0, 3.0, 0.2), Vector3(0.0, 1.75, -2.55), station_wall_material, true)
	_add_box(station, "LeftWall", Vector3(0.2, 3.0, 5.0), Vector3(-2.9, 1.75, 0.0), station_wall_material, true)
	_add_box(station, "RightWall", Vector3(0.2, 3.0, 5.0), Vector3(2.9, 1.75, 0.0), station_wall_material, true)
	_add_box(station, "FrontLeftWall", Vector3(1.85, 3.0, 0.2), Vector3(-2.075, 1.75, 2.55), station_wall_material, true)
	_add_box(station, "FrontRightWall", Vector3(1.85, 3.0, 0.2), Vector3(2.075, 1.75, 2.55), station_wall_material, true)
	_add_box(station, "DoorLintel", Vector3(2.3, 0.65, 0.2), Vector3(0.0, 2.925, 2.55), station_wall_material, true)

	_add_box(
		station,
		"LeftRoofSlope",
		Vector3(3.55, 0.22, 5.55),
		Vector3(-1.55, 3.35, 0.0),
		station_roof_material,
		false,
		Vector3(0.0, 0.0, 0.42)
	)
	_add_box(
		station,
		"RightRoofSlope",
		Vector3(3.55, 0.22, 5.55),
		Vector3(1.55, 3.35, 0.0),
		station_roof_material,
		false,
		Vector3(0.0, 0.0, -0.42)
	)

	_add_box(station, "FrontWindowLeft", Vector3(0.9, 0.75, 0.06), Vector3(-2.05, 1.95, 2.42), window_material)
	_add_box(station, "FrontWindowRight", Vector3(0.9, 0.75, 0.06), Vector3(2.05, 1.95, 2.42), window_material)
	_add_box(station, "DoorShadow", Vector3(1.2, 2.2, 0.05), Vector3(0.0, 1.25, 2.43), trim_material)

	_add_cylinder(
		station,
		"WeatherMast",
		0.07,
		0.07,
		7.0,
		Vector3(3.8, 3.5, -1.5),
		trim_material
	)
	_add_box(station, "MastCrossbar", Vector3(1.4, 0.07, 0.07), Vector3(3.8, 5.8, -1.5), trim_material)
	_add_sphere(station, "WarningLamp", Vector3(0.0, 3.15, 2.62), 0.16, lamp_material)

	var sign := Label3D.new()
	sign.name = "StationSign"
	sign.text = "METEOROLOGICAL STATION 04"
	sign.font_size = 30
	sign.outline_size = 6
	sign.modulate = Color(0.84, 0.82, 0.68)
	sign.position = Vector3(0.0, 2.65, 2.68)
	sign.rotation.y = PI
	sign.pixel_size = 0.004
	station.add_child(sign)


func _create_rocks() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = TREE_SEED + 17
	for index in range(18):
		var angle := rng.randf_range(0.0, TAU)
		var distance := rng.randf_range(11.0, 34.0)
		var position := Vector3(cos(angle) * distance, 0.0, sin(angle) * distance)
		if absf(position.x) < 4.0 and position.z > -28.0 and position.z < 12.0:
			continue
		var rock_mesh := SphereMesh.new()
		rock_mesh.radial_segments = 8
		rock_mesh.rings = 4
		var rock := MeshInstance3D.new()
		rock.name = "ValleyRock_%02d" % index
		rock.mesh = rock_mesh
		rock.material_override = rock_material
		rock.position = position + Vector3(0.0, 0.35, 0.0)
		rock.scale = Vector3(
			rng.randf_range(0.45, 1.2),
			rng.randf_range(0.35, 0.8),
			rng.randf_range(0.45, 1.1)
		)
		add_child(rock)


func _create_pickups() -> void:
	_spawn_pickup("WoodBundle", "wood", "WOOD", 2, Vector3(2.4, 0.75, 3.0), Color(0.45, 0.25, 0.13), true)
	_spawn_pickup("StoneChunk", "stone", "STONE", 1, Vector3(-2.7, 0.7, 1.0), Color(0.42, 0.47, 0.45), false)
	_spawn_pickup("WoodBundle_02", "wood", "WOOD", 2, Vector3(4.5, 0.75, -5.0), Color(0.45, 0.25, 0.13), true)
	_spawn_pickup("StoneChunk_02", "stone", "STONE", 1, Vector3(-4.2, 0.7, -8.0), Color(0.42, 0.47, 0.45), false)


func _spawn_pickup(
	node_name: String,
	resource_id: String,
	display_name: String,
	amount: int,
	world_position: Vector3,
	color: Color,
	is_wood: bool
) -> void:
	var pickup := Area3D.new()
	pickup.name = node_name
	pickup.position = world_position
	pickup.collision_layer = 1
	pickup.collision_mask = 0
	pickup.set_script(load("res://scripts/resource_pickup.gd"))
	pickup.set("resource_id", resource_id)
	pickup.set("display_name", display_name)
	pickup.set("amount", amount)

	var collision := CollisionShape3D.new()
	var sphere_shape := SphereShape3D.new()
	sphere_shape.radius = 1.0
	collision.shape = sphere_shape
	pickup.add_child(collision)

	if is_wood:
		var log_mesh := CylinderMesh.new()
		log_mesh.top_radius = 0.2
		log_mesh.bottom_radius = 0.2
		log_mesh.height = 1.0
		log_mesh.radial_segments = 7
		var log := MeshInstance3D.new()
		log.mesh = log_mesh
		log.material_override = _make_material(color)
		log.position = Vector3(0.0, -0.25, 0.0)
		log.rotation.z = PI / 2.0
		pickup.add_child(log)
	else:
		var stone_mesh := SphereMesh.new()
		stone_mesh.radial_segments = 8
		stone_mesh.rings = 5
		var stone := MeshInstance3D.new()
		stone.mesh = stone_mesh
		stone.material_override = _make_material(color)
		stone.position = Vector3(0.0, -0.3, 0.0)
		stone.scale = Vector3(0.55, 0.45, 0.55)
		pickup.add_child(stone)

	add_child(pickup)


func _add_box(
	parent: Node3D,
	node_name: String,
	size: Vector3,
	local_position: Vector3,
	material: Material,
	solid: bool = false,
	local_rotation: Vector3 = Vector3.ZERO
) -> Node3D:
	var holder: Node3D
	if solid:
		holder = StaticBody3D.new()
	else:
		holder = Node3D.new()
	holder.name = node_name
	holder.position = local_position
	holder.rotation = local_rotation

	var box_mesh := BoxMesh.new()
	box_mesh.size = size
	var mesh_instance := MeshInstance3D.new()
	mesh_instance.mesh = box_mesh
	mesh_instance.material_override = material
	holder.add_child(mesh_instance)

	if solid:
		var collision := CollisionShape3D.new()
		var box_shape := BoxShape3D.new()
		box_shape.size = size
		collision.shape = box_shape
		holder.add_child(collision)

	parent.add_child(holder)
	return holder


func _add_cylinder(
	parent: Node3D,
	node_name: String,
	top_radius: float,
	bottom_radius: float,
	height: float,
	local_position: Vector3,
	material: Material
) -> MeshInstance3D:
	var cylinder_mesh := CylinderMesh.new()
	cylinder_mesh.top_radius = top_radius
	cylinder_mesh.bottom_radius = bottom_radius
	cylinder_mesh.height = height
	cylinder_mesh.radial_segments = 8
	var instance := MeshInstance3D.new()
	instance.name = node_name
	instance.mesh = cylinder_mesh
	instance.material_override = material
	instance.position = local_position
	parent.add_child(instance)
	return instance


func _add_sphere(
	parent: Node3D,
	node_name: String,
	local_position: Vector3,
	radius: float,
	material: Material
) -> MeshInstance3D:
	var sphere_mesh := SphereMesh.new()
	sphere_mesh.radius = radius
	sphere_mesh.height = radius * 2.0
	sphere_mesh.radial_segments = 10
	sphere_mesh.rings = 5
	var instance := MeshInstance3D.new()
	instance.name = node_name
	instance.mesh = sphere_mesh
	instance.material_override = material
	instance.position = local_position
	parent.add_child(instance)
	return instance
