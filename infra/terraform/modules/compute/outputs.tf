output "instance_id" {
  description = "EC2 instance ID."
  value       = aws_instance.app.id
}

output "public_ip" {
  description = "Stable public IPv4 (Elastic IP) — the A record target."
  value       = aws_eip.app.public_ip
}

output "public_ipv6" {
  description = "Public IPv6 address — the AAAA record target."
  value       = one(aws_instance.app.ipv6_addresses)
}

output "instance_role_arn" {
  description = "IAM role ARN attached to the instance."
  value       = aws_iam_role.instance.arn
}
