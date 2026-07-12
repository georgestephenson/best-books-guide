output "identity_arn" {
  description = "SES domain identity ARN (used to scope the instance's ses:SendEmail)."
  value       = aws_ses_domain_identity.main.arn
}

output "smtp_username" {
  description = "SMTP username for Monit alerts (the IAM access key ID)."
  value       = aws_iam_access_key.monit_smtp.id
}

output "smtp_password" {
  description = "SMTP password for Monit alerts (region-derived). Store in Ansible Vault."
  value       = aws_iam_access_key.monit_smtp.ses_smtp_password_v4
  sensitive   = true
}

output "smtp_endpoint" {
  description = "SES SMTP endpoint for the Monit mailserver config."
  value       = "email-smtp.${var.aws_region}.amazonaws.com"
}
