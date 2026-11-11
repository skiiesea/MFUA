extends CharacterBody3D

@export var move_speed: float = 4.5
@export var sprint_speed: float = 6.5
@export var jump_velocity: float = 4.2
@export var mouse_sensitivity: float = 0.002
@export var interaction_distance: float = 2.5

@onready var head: Node3D = $Head
@onready var camera: Camera3D = $Head/Camera3D
@onready var interaction_ray: RayCast3D = $Head/Camera3D/InteractionRay

var gravity: float = float(ProjectSettings.get_setting("physics/3d/default_gravity"))

func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	interaction_ray.target_position = Vector3(0.0, 0.0, -interaction_distance)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * mouse_sensitivity)
		head.rotate_x(-event.relative.y * mouse_sensitivity)
		head.rotation.x = clampf(head.rotation.x, deg_to_rad(-85.0), deg_to_rad(85.0))
	elif event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ESCAPE:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		elif event.keycode == KEY_E:
			_interact()
	elif event is InputEventMouseButton and event.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= gravity * delta
	elif Input.is_key_pressed(KEY_SPACE):
		velocity.y = jump_velocity

	var input_vector := Vector2.ZERO
	input_vector.x = float(Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_A))
	input_vector.y = float(Input.is_key_pressed(KEY_W)) - float(Input.is_key_pressed(KEY_S))
	input_vector = input_vector.normalized()

	var direction := (transform.basis * Vector3(input_vector.x, 0.0, -input_vector.y)).normalized()
	var current_speed := sprint_speed if Input.is_key_pressed(KEY_SHIFT) else move_speed
	if direction != Vector3.ZERO:
		velocity.x = direction.x * current_speed
		velocity.z = direction.z * current_speed
	else:
		velocity.x = move_toward(velocity.x, 0.0, move_speed * 8.0 * delta)
		velocity.z = move_toward(velocity.z, 0.0, move_speed * 8.0 * delta)

	move_and_slide()

func _interact() -> void:
	interaction_ray.force_raycast_update()
	if not interaction_ray.is_colliding():
		return
	var target := interaction_ray.get_collider()
	if target != null and target.has_method("interact"):
		target.interact(self)
