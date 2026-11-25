extends Area3D

@export var resource_id: String = "wood"
@export var display_name: String = "WOOD"
@export_range(1, 20, 1) var amount: int = 1


func _ready() -> void:
	add_to_group("resource_pickups")


func interact(player: Node) -> void:
	if not player.has_method("add_resource"):
		return

	player.add_resource(resource_id, amount, name)
	queue_free()
