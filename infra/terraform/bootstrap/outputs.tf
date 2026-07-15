output "state_bucket" {
  description = "S3 bucket for Terraform remote state — use as the backend `bucket` in envs/prod."
  value       = aws_s3_bucket.state.id
}

output "oidc_provider_arn" {
  description = "GitHub Actions OIDC provider ARN."
  value       = aws_iam_openid_connect_provider.github.arn
}

output "github_actions_role_arn" {
  description = "OIDC role ARN for GitHub Actions — set as the AWS_ROLE_ARN repo variable used by workflows."
  value       = aws_iam_role.github_actions.arn
}

output "account_id" {
  description = "AWS account ID (handy for wiring later configs)."
  value       = data.aws_caller_identity.current.account_id
}
