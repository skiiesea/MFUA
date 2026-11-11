extends CharacterBody3D

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
	"stone": 0
}

var prompt_label: Label
var inventory_label: Label
var notification_label: Label
var notification_time: float = 0.0


func _ready() -> void:
	floor_snap_length = 0.22
	camera.current = true
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	interaction_ray.target_position = Vector3(0.0, 0.0, -interaction_distance)
	_create_hud()
	_update_inventory_hud()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * mouse_sensitivity)
		head.rotate_x(-event.relative.y * mouse_sensitivity)
		head.rotation.x = clampf(head.rotation.x, deg_to_rad(-84.0), deg_to_rad(84.0))
	elif event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ESCAPE:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		elif event.keycode == KEY_E:
			_interact()
	elif event is InputEventMouseButton and event.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _process(delta: float) -> void:
	_update_interaction_prompt()
	if notification_time > 0.0:
		notification_time = maxf(0.0, notification_time - delta)
		notification_label.visible = true
	else:
		notification_label.visible = false


func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= gravity * delta
	elif Input.is_action_just_pressed("jump"):
		velocity.y = jump_velocity

	var input_vector := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var direction := (global_transform.basis * Vector3(input_vector.x, 0.0, input_vector.y)).normalized()
	var current_speed := sprint_speed if Input.is_action_pressed("sprint") else move_speed
	var acceleration := ground_acceleration if is_on_floor() else air_acceleration

	if direction.length_squared() > 0.001:
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


func add_resource(resource_id: String, amount: int) -> void:
	if amount <= 0:
		return

	inventory[resource_id] = int(inventory.get(resource_id, 0)) + amount
	_update_inventory_hud()
	notification_label.text = "+%d %s" % [amount, resource_id.to_upper()]
	notification_time = 1.8


func _update_inventory_hud() -> void:
	if not is_instance_valid(inventory_label):
		return

	inventory_label.text = "WOOD  %02d     STONE  %02d" % [
		int(inventory.get("wood", 0)),
		int(inventory.get("stone", 0))
	]


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
	inventory_label.add_theme_font_size_override("font_size", 17)
	inventory_label.add_theme_color_override("font_color", Color(0.88, 0.89, 0.81))
	root.add_child(inventory_label)

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
