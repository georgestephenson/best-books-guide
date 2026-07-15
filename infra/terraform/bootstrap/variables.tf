variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "eu-west-2"
}

variable "project" {
  description = "Project name; used for tagging and resource naming."
  type        = string
  default     = "best-books-guide"
}

variable "github_repo" {
  description = "GitHub repository (owner/name) whose Actions may assume the CI role via OIDC."
  type        = string
  default     = "georgestephenson/best-books-guide"
}

variable "state_bucket_name" {
  description = "Globally-unique S3 bucket name for Terraform remote state."
  type        = string
  default     = "bestbooks-terraform-state"
}

variable "bucket_prefix" {
  description = "Prefix for the app's S3 buckets (created in envs/prod); referenced here to scope the CI deploy policy."
  type        = string
  default     = "bestbooks-prod"
}

variable "budget_limit_usd" {
  description = "Monthly cost budget in USD; alerts by email at 80% actual and 100% forecast."
  type        = number
  default     = 30
}

variable "budget_notify_email" {
  description = "Email address for AWS Budgets alerts. No default: set it in terraform.tfvars."
  type        = string
}
