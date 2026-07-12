output "backups_bucket" {
  description = "Backups bucket name."
  value       = aws_s3_bucket.this["backups"].id
}

output "backups_bucket_arn" {
  description = "Backups bucket ARN."
  value       = aws_s3_bucket.this["backups"].arn
}

output "media_bucket" {
  description = "Media (cover-image replica) bucket name."
  value       = aws_s3_bucket.this["media"].id
}

output "media_bucket_arn" {
  description = "Media bucket ARN."
  value       = aws_s3_bucket.this["media"].arn
}

output "releases_bucket" {
  description = "Release-artifacts bucket name."
  value       = aws_s3_bucket.this["releases"].id
}

output "releases_bucket_arn" {
  description = "Release-artifacts bucket ARN."
  value       = aws_s3_bucket.this["releases"].arn
}
