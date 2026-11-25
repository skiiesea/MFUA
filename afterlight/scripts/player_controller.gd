extends CharacterBody3D

const SAVE_PATH: String = "user://afterlight_save.cfg"
const SAVE_VERSION: int = 1
const POND_POSITION: Vector2 = Vector2(22.0, -23.0)
const POND_DRINK_DISTANCE: float = 8.5

@export var move_speed: float = 4.5
@export var sprint_speed: float = 6.5
@export var jump_velocity: float = 4.2
@export var ground_acceleration: float = 18.0
@export var air_acceleration: float = 5.0
@export var mouse_sensitivity: float = 0.002
@export var interaction_distance: float = 3.0

@onready var head: Node3D = $Head
@onready var camera: Camera3D = $Head/Camera3D
@onready var interaction_ray: RayCast3D = $Head/Camera3D/InteractionRay

var gravity: float = float(ProjectSettings.get_setting("physics/3d/default_gravity"))
var inventory: Dictionary = {
	"wood": 0,
	"stone": 0,
	"berries": 0
}
var collected_pickups: Array[String] = []

var health: float = 100.0
var hunger: float = 100.0
var thirst: float = 100.0
var stamina: float = 100.0

var prompt_label: Label
var inventory_label: Label
var survival_label: Label
var notification_label: Label
var notification_time: float = 0.0
var hud_refresh_time: float = 0.0


func _ready() -> void:
	floor_snap_length = 0.22
	camera.current = true
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	interaction_ray.target_position = Vector3(0.0, 0.0, -interaction_distance)
	_create_hud()
	_update_inventory_hud()
	_update_survival_hud()

	if FileAccess.file_exists(SAVE_PATH):
		load_game(false)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * mouse_sensitivity)
		head.rotate_x(-event.relative.y * mouse_sensitivity)
		head.rotation.x = clampf(head.rotation.x, deg_to_rad(-84.0), deg_to_rad(84.0))
	elif event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ESCAPE:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		elif event.is_action_pressed("interact"):
			_interact()
		elif event.is_action_pressed("save_game"):
			save_game()
		elif event.is_action_pressed("load_game"):
			load_game()
		elif event.is_action_pressed("consume_food"):
			_consume_berries()
		elif event.is_action_pressed("drink_water"):
			_drink_from_pond()
	elif event is InputEventMouseButton and event.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _process(delta: float) -> void:
	_update_interaction_prompt()

	if notification_time > 0.0:
		notification_time = maxf(0.0, notification_time - delta)
		notification_label.visible = notification_time > 0.0
	else:
		notification_label.visible = false

	hud_refresh_time -= delta
	if hud_refresh_time <= 0.0:
		hud_refresh_time = 0.25
		_update_survival_hud()


func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= gravity * delta
	elif Input.is_action_just_pressed("jump"):
		velocity.y = jump_velocity

	var input_vector := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var direction := (global_transform.basis * Vector3(input_vector.x, 0.0, input_vector.y)).normalized()
	var moving := direction.length_squared() > 0.001
	var wants_sprint := Input.is_action_pressed("sprint") and moving and stamina > 0.0
	var current_speed := sprint_speed if wants_sprint else move_speed
	var acceleration := ground_acceleration if is_on_floor() else air_acceleration

	if wants_sprint:
		stamina = maxf(0.0, stamina - 22.0 * delta)
	else:
		stamina = minf(100.0, stamina + 16.0 * delta)

	hunger = maxf(0.0, hunger - 0.035 * delta)
	thirst = maxf(0.0, thirst - 0.055 * delta)
	if hunger <= 0.0 or thirst <= 0.0:
		health = maxf(0.0, health - 1.5 * delta)

	if moving:
		velocity.x = move_toward(velocity.x, direction.x * current_speed, acceleration * delta)
		velocity.z = move_toward(velocity.z, direction.z * current_speed, acceleration * delta)
	else:
		velocity.x = move_toward(velocity.x, 0.0, ground_acceleration * delta)
		velocity.z = move_toward(velocity.z, 0.0, ground_acceleration * delta)

	move_and_slide()


func _update_interaction_prompt() -> void:
	if not is_instance_valid(prompt_label):
		return

	var target: Object = interaction_ray.get_collider()
	if target != null and target.has_method("interact"):
		var target_name := str(target.get("display_name"))
		prompt_label.text = "[E]  PICK UP  " + target_name
	else:
		prompt_label.text = ""


func _interact() -> void:
	interaction_ray.force_raycast_update()
	if not interaction_ray.is_colliding():
		return

	var target: Object = interaction_ray.get_collider()
	if target != null and target.has_method("interact"):
		target.interact(self)


func add_resource(resource_id: String, amount: int, pickup_id: String = "") -> void:
	if amount <= 0:
		return

	if not inventory.has(resource_id):
		return

	inventory[resource_id] = int(inventory.get(resource_id, 0)) + amount
	if pickup_id != "" and not collected_pickups.has(pickup_id):
		collected_pickups.append(pickup_id)

	_update_inventory_hud()
	_show_notification("+%d %s" % [amount, resource_id.to_upper()])


func _consume_berries() -> void:
	if int(inventory.get("berries", 0)) <= 0:
		_show_notification("NO BERRIES")
		return

	inventory["berries"] = int(inventory["berries"]) - 1
	hunger = minf(100.0, hunger + 35.0)
	health = minf(100.0, health + 4.0)
	_update_inventory_hud()
	_update_survival_hud()
	_show_notification("ATE WILD BERRIES")


func _drink_from_pond() -> void:
	var player_position := Vector2(global_position.x, global_position.z)
	if player_position.distance_to(POND_POSITION) > POND_DRINK_DISTANCE:
		_show_notification("NO WATER SOURCE NEARBY")
		return

	if thirst >= 99.0:
		_show_notification("NOT THIRSTY")
		return

	thirst = minf(100.0, thirst + 45.0)
	_update_survival_hud()
	_show_notification("DRANK FROM THE POND")


func save_game() -> bool:
	var config := ConfigFile.new()
	config.set_value("meta", "version", SAVE_VERSION)
	config.set_value("player", "position", global_position)
	config.set_value("player", "yaw", rotation.y)
	config.set_value("player", "pitch", head.rotation.x)
	config.set_value("player", "inventory", inventory)
	config.set_value("player", "health", health)
	config.set_value("player", "hunger", hunger)
	config.set_value("player", "thirst", thirst)
	config.set_value("player", "stamina", stamina)
	config.set_value("world", "collected_pickups", collected_pickups)

	var error := config.save(SAVE_PATH)
	if error == OK:
		_show_notification("GAME SAVED")
		return true

	_show_notification("SAVE FAILED")
	return false


func load_game(show_message: bool = true) -> bool:
	var config := ConfigFile.new()
	var error := config.load(SAVE_PATH)
	if error != OK:
		if show_message:
			_show_notification("NO SAVE FOUND")
		return false

	var version := int(config.get_value("meta", "version", 0))
	if version != SAVE_VERSION:
		if show_message:
			_show_notification("SAVE VERSION NOT SUPPORTED")
		return false

	var saved_position: Variant = config.get_value("player", "position", global_position)
	if typeof(saved_position) == TYPE_VECTOR3:
		global_position = saved_position

	rotation.y = float(config.get_value("player", "yaw", rotation.y))
	head.rotation.x = clampf(
		float(config.get_value("player", "pitch", head.rotation.x)),
		deg_to_rad(-84.0),
		deg_to_rad(84.0)
	)

	var saved_inventory: Variant = config.get_value("player", "inventory", {})
	if saved_inventory is Dictionary:
		for resource_id in ["wood", "stone", "berries"]:
			inventory[resource_id] = maxi(0, int(saved_inventory.get(resource_id, 0)))

	health = clampf(float(config.get_value("player", "health", health)), 0.0, 100.0)
	hunger = clampf(float(config.get_value("player", "hunger", hunger)), 0.0, 100.0)
	thirst = clampf(float(config.get_value("player", "thirst", thirst)), 0.0, 100.0)
	stamina = clampf(float(config.get_value("player", "stamina", stamina)), 0.0, 100.0)

	collected_pickups.clear()
	var saved_pickups: Variant = config.get_value("world", "collected_pickups", [])
	if saved_pickups is Array:
		for pickup_id in saved_pickups:
			if pickup_id is String and not collected_pickups.has(pickup_id):
				collected_pickups.append(pickup_id)

	_update_inventory_hud()
	_update_survival_hud()
	if show_message:
		_show_notification("GAME LOADED")
	return true


func _update_inventory_hud() -> void:
	if not is_instance_valid(inventory_label):
		return

	inventory_label.text = "WOOD  %02d     STONE  %02d     BERRIES  %02d" % [
		int(inventory.get("wood", 0)),
		int(inventory.get("stone", 0)),
		int(inventory.get("berries", 0))
	]


func _update_survival_hud() -> void:
	if not is_instance_valid(survival_label):
		return

	survival_label.text = "HP %03d   FOOD %03d   WATER %03d   STAMINA %03d" % [
		int(roundf(health)),
		int(roundf(hunger)),
		int(roundf(thirst)),
		int(roundf(stamina))
	]


func _show_notification(message: String) -> void:
	if not is_instance_valid(notification_label):
		return

	notification_label.text = message
	notification_time = 1.8
	notification_label.visible = true


func _create_hud() -> void:
	var canvas := CanvasLayer.new()
	canvas.name = "GameHUD"
	canvas.layer = 5
	add_child(canvas)

	var root := Control.new()
	root.name = "HUDRoot"
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	canvas.add_child(root)

	var crosshair := Label.new()
	crosshair.name = "Crosshair"
	crosshair.text = "+"
	crosshair.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	crosshair.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	crosshair.add_theme_font_size_override("font_size", 22)
	crosshair.add_theme_color_override("font_color", Color(0.92, 0.91, 0.82, 0.9))
	crosshair.anchor_left = 0.5
	crosshair.anchor_top = 0.5
	crosshair.anchor_right = 0.5
	crosshair.anchor_bottom = 0.5
	crosshair.offset_left = -12.0
	crosshair.offset_top = -18.0
	crosshair.offset_right = 12.0
	crosshair.offset_bottom = 18.0
	root.add_child(crosshair)

	inventory_label = Label.new()
	inventory_label.name = "InventoryReadout"
	inventory_label.position = Vector2(24.0, 22.0)
	inventory_label.add_theme_font_size_override("font_size", 15)
	inventory_label.add_theme_color_override("font_color", Color(0.88, 0.89, 0.81))
	root.add_child(inventory_label)

	survival_label = Label.new()
	survival_label.name = "SurvivalReadout"
	survival_label.anchor_left = 1.0
	survival_label.anchor_right = 1.0
	survival_label.offset_left = -430.0
	survival_label.offset_right = -24.0
	survival_label.offset_top = 22.0
	survival_label.offset_bottom = 48.0
	survival_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	survival_label.add_theme_font_size_override("font_size", 15)
	survival_label.add_theme_color_override("font_color", Color(0.88, 0.89, 0.81))
	root.add_child(survival_label)

	prompt_label = Label.new()
	prompt_label.name = "InteractionPrompt"
	prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	prompt_label.add_theme_font_size_override("font_size", 18)
	prompt_label.add_theme_color_override("font_color", Color(0.96, 0.9, 0.72))
	prompt_label.anchor_left = 0.5
	prompt_label.anchor_top = 1.0
	prompt_label.anchor_right = 0.5
	prompt_label.anchor_bottom = 1.0
	prompt_label.offset_left = -220.0
	prompt_label.offset_top = -92.0
	prompt_label.offset_right = 220.0
	prompt_label.offset_bottom = -54.0
	root.add_child(prompt_label)

	notification_label = Label.new()
	notification_label.name = "PickupNotification"
	notification_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	notification_label.add_theme_font_size_override("font_size", 17)
	notification_label.add_theme_color_override("font_color", Color(0.76, 0.88, 0.72))
	notification_label.anchor_left = 0.5
	notification_label.anchor_top = 1.0
	notification_label.anchor_right = 0.5
	notification_label.anchor_bottom = 1.0
	notification_label.offset_left = -180.0
	notification_label.offset_top = -132.0
	notification_label.offset_right = 180.0
	notification_label.offset_bottom = -98.0
	notification_label.visible = false
	root.add_child(notification_label)


func _exit_tree() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
