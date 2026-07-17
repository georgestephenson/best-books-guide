variable "project" {
  description = "Project name; used for resource naming/tagging."
  type        = string
}

variable "aws_region" {
  description = "AWS region (used for the S3 gateway endpoint service name)."
  type        = string
}

variable "vpc_cidr" {
  description = "IPv4 CIDR for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

