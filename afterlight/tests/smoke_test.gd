extends SceneTree


func _initialize() -> void:
	_remove_test_save()

	var packed_scene := load("res://scenes/main.tscn") as PackedScene
	if not _check(packed_scene != null, "Main scene could not be loaded."):
		return

	var first_world := packed_scene.instantiate()
	root.add_child(first_world)

	var first_player: Variant = first_world.get_node_or_null("Player")
	if not _check(first_player != null, "Player node is missing."):
		return
	if not _check(first_player.inventory.has("berries"), "Berry inventory slot is missing."):
		return

	var berry_pickup: Variant = first_world.get_node_or_null("BerryCluster_01")
	if not _check(berry_pickup != null, "Berry pickup was not created."):
		return

	berry_pickup.interact(first_player)
	if not _check(int(first_player.inventory["berries"]) == 3, "Berry pickup did not update inventory."):
		return
	if not _check(first_player.collected_pickups.has("BerryCluster_01"), "Collected pickup ID was not recorded."):
		return
	if not _check(first_player.save_game(), "Save file could not be written."):
		return

	root.remove_child(first_world)
	first_world.free()

	var second_world := packed_scene.instantiate()
	root.add_child(second_world)

	var second_player: Variant = second_world.get_node_or_null("Player")
	if not _check(second_player != null, "Player node was not recreated."):
		return
	if not _check(int(second_player.inventory["berries"]) == 3, "Inventory was not restored from save."):
		return

	var restored_berry: Variant = second_world.get_node_or_null("BerryCluster_01")
	if restored_berry != null and not restored_berry.is_queued_for_deletion():
		_check(false, "Collected berry pickup respawned after loading.")
		return

	root.remove_child(second_world)
	second_world.free()
	_remove_test_save()
	print("AFTERLIGHT Godot scene/save smoke test passed.")
	quit()


func _check(condition: bool, message: String) -> bool:
	if not condition:
		push_error(message)
		_remove_test_save()
		quit(1)
		return false
	return true


func _remove_test_save() -> void:
	var save_path := ProjectSettings.globalize_path("user://afterlight_save.cfg")
	if FileAccess.file_exists("user://afterlight_save.cfg"):
		DirAccess.remove_absolute(save_path)
