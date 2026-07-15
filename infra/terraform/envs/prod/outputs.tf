output "instance_public_ip" {
  description = "Elastic IP — put this in the Ansible inventory."
  value       = module.compute.public_ip
}

output "instance_public_ipv6" {
  description = "Instance IPv6 address."
  value       = module.compute.public_ipv6
}

output "instance_id" {
  description = "EC2 instance ID."
  value       = module.compute.instance_id
}

output "domain_name" {
  description = "Apex domain."
  value       = var.domain_name
}

output "backups_bucket" {
  description = "Backups bucket name."
  value       = module.storage.backups_bucket
}

output "media_bucket" {
  description = "Media bucket name."
  value       = module.storage.media_bucket
}

output "releases_bucket" {
  description = "Releases bucket name."
  value       = module.storage.releases_bucket
}

output "ses_smtp_username" {
  description = "SMTP username for Monit alerts (store in Ansible Vault)."
  value       = module.email.smtp_username
}

output "ses_smtp_password" {
  description = "SMTP password for Monit alerts (store in Ansible Vault). `terraform output -raw ses_smtp_password` to read."
  value       = module.email.smtp_password
  sensitive   = true
}

output "ses_smtp_endpoint" {
  description = "SES SMTP endpoint for Monit."
  value       = module.email.smtp_endpoint
}

output "ssh_command" {
  description = "Convenience SSH command once the host is up."
  value       = "ssh ubuntu@${module.compute.public_ip}"
}
