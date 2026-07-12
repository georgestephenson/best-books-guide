variable "aws_region" {
  description = "AWS region."
  type        = string
  default     = "eu-west-2"
}

variable "project" {
  description = "Project name; used for naming/tagging."
  type        = string
  default     = "best-books-guide"
}

variable "domain_name" {
  description = "Apex domain (hosted zone must already exist in Route53)."
  type        = string
  default     = "bestbooks.guide"
}

variable "bucket_prefix" {
  description = "Prefix for the app's S3 buckets."
  type        = string
  default     = "bestbooks-prod"
}

variable "instance_type" {
  description = "EC2 instance type (arm64/Graviton)."
  type        = string
  default     = "t4g.small"
}

variable "admin_cidr" {
  description = "CIDR allowed to SSH to the host (your admin IP, e.g. 203.0.113.4/32)."
  type        = string
}

variable "ssh_public_key" {
  description = "SSH public key material for the admin key pair."
  type        = string
}

variable "alert_email" {
  description = "Address for DMARC reports (and shared with ops alerting)."
  type        = string
}
