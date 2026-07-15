config {
  # Lint every module under infra/terraform when run with --recursive.
  call_module_type = "all"
}

plugin "terraform" {
  enabled = true
  preset  = "recommended"
}
