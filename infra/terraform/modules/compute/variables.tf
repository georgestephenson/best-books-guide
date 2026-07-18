variable "project" {
  description = "Project name; used for resource naming/tagging."
  type        = string
}

variable "aws_region" {
  description = "AWS region (used to build the SES identity ARN for the instance policy)."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type (arm64/Graviton)."
  type        = string
  default     = "t4g.small"
}

variable "root_volume_gb" {
  description = "Root EBS volume size in GB."
  type        = number
  default     = 30
}

variable "subnet_id" {
  description = "Public subnet to launch the instance in."
  type        = string
}

variable "security_group_id" {
  description = "Security group for the instance."
  type        = string
}

variable "ssh_public_key" {
  description = "SSH public key material for the admin key pair (Ansible access)."
  type        = string
}

variable "ami_id" {
  description = "Override AMI. Leave null to use the latest Ubuntu 24.04 arm64 image."
  type        = string
  default     = null
}

variable "backups_bucket_arn" {
  description = "ARN of the backups bucket (instance gets read/write)."
  type        = string
}

variable "media_bucket_arn" {
  description = "ARN of the media bucket (instance gets read/write)."
  type        = string
}

variable "releases_bucket_arn" {
  description = "ARN of the releases bucket (instance gets read-only)."
  type        = string
}
