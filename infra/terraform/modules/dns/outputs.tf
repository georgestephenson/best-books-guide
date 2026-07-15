output "zone_id" {
  description = "Route53 hosted zone ID (for the SES/email records)."
  value       = data.aws_route53_zone.main.zone_id
}

output "domain_name" {
  description = "The apex domain."
  value       = var.domain_name
}
