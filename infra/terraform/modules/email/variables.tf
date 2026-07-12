variable "project" {
  description = "Project name; used for the Monit SMTP IAM user name."
  type        = string
}

variable "aws_region" {
  description = "AWS region (SES MAIL FROM feedback endpoint is region-specific)."
  type        = string
}

variable "domain_name" {
  description = "Domain to verify as an SES sending identity."
  type        = string
}

variable "zone_id" {
  description = "Route53 hosted zone ID to create SES/DKIM/DMARC records in."
  type        = string
}

variable "mail_from_subdomain" {
  description = "Subdomain for the custom MAIL FROM (SPF alignment)."
  type        = string
  default     = "mail"
}

variable "dmarc_report_email" {
  description = "Address for DMARC aggregate (rua) reports."
  type        = string
}
