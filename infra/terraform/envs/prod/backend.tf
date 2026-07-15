terraform {
  # Remote state in the bucket created by bootstrap. Native S3 locking
  # (use_lockfile) — no DynamoDB lock table (docs/07).
  backend "s3" {
    bucket       = "bestbooks-terraform-state"
    key          = "envs/prod/terraform.tfstate"
    region       = "eu-west-2"
    encrypt      = true
    use_lockfile = true
  }
}
