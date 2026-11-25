extends SceneTree


func _initialize() -> void:
	call_deferred("_run_smoke_test")


func _run_smoke_test() -> void:
	var packed_scene := load("res://scenes/main.tscn") as PackedScene
	assert(packed_scene != null, "Main scene could not be loaded.")

	var first_world := packed_scene.instantiate()
	root.add_child(first_world)
	await process_frame

	var first_player: Variant = first_world.get_node_or_null("Player")
	assert(first_player != null, "Player node is missing.")
	assert(first_player.inventory.has("berries"), "Berry inventory slot is missing.")

	var berry_pickup: Variant = first_world.get_node_or_null("BerryCluster_01")
	assert(berry_pickup != null, "Berry pickup was not created.")
	berry_pickup.interact(first_player)
	assert(int(first_player.inventory["berries"]) == 3, "Berry pickup did not update inventory.")
	assert(first_player.collected_pickups.has("BerryCluster_01"), "Collected pickup ID was not recorded.")
	assert(first_player.save_game(), "Save file could not be written.")

	first_world.queue_free()
	await process_frame

	var second_world := packed_scene.instantiate()
	root.add_child(second_world)
	await process_frame
	await process_frame

	var second_player: Variant = second_world.get_node_or_null("Player")
	assert(second_player != null, "Player node was not recreated.")
	assert(int(second_player.inventory["berries"]) == 3, "Inventory was not restored from save.")
	assert(
		second_world.get_node_or_null("BerryCluster_01") == null,
		"Collected berry pickup respawned after loading."
	)

	var save_path := ProjectSettings.globalize_path("user://afterlight_save.cfg")
	if FileAccess.file_exists("user://afterlight_save.cfg"):
		DirAccess.remove_absolute(save_path)

	print("AFTERLIGHT Godot scene/save smoke test passed.")
	quit()
