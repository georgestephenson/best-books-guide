# Remote-state bucket for every other Terraform config (envs/prod uses this as its
# S3 backend with `use_lockfile = true` — native locking, no DynamoDB; docs/07).

resource "aws_s3_bucket" "state" {
  bucket = var.state_bucket_name

  # The state store must not be destroyed by an errant `terraform destroy`.
  # To intentionally remove it, delete this block first.
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled" # keep state history / allow recovery of a clobbered state
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    object_ownership = "BucketOwnerEnforced" # disable ACLs entirely
  }
}
