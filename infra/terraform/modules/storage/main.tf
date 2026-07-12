# App buckets (docs/06 §S3 buckets). The Terraform state bucket lives in bootstrap.
# Versioning is intentionally off here — these hold nightly backups / a media replica /
# release tarballs, all reproducible, so object history isn't worth the storage.

locals {
  buckets = {
    backups  = "${var.bucket_prefix}-backups"  # nightly pg_dump + redis RDB
    media    = "${var.bucket_prefix}-media"    # cover-image replica
    releases = "${var.bucket_prefix}-releases" # release-<sha>.tar.gz from CI
  }
}

resource "aws_s3_bucket" "this" {
  for_each = local.buckets
  bucket   = each.value
  tags     = { Name = each.value }
}

resource "aws_s3_bucket_public_access_block" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_ownership_controls" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# Backups: dailies expire after 30d, weeklies (separate prefix) after 90d.
resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.this["backups"].id

  rule {
    id     = "expire-dailies"
    status = "Enabled"
    filter { prefix = "daily/" }
    expiration { days = 30 }
  }

  rule {
    id     = "expire-weeklies"
    status = "Enabled"
    filter { prefix = "weekly/" }
    expiration { days = 90 }
  }
}

# Releases: keep the last ~2 months of build artifacts.
resource "aws_s3_bucket_lifecycle_configuration" "releases" {
  bucket = aws_s3_bucket.this["releases"].id

  rule {
    id     = "expire-old-releases"
    status = "Enabled"
    filter {} # whole bucket
    expiration { days = 60 }
  }
}
