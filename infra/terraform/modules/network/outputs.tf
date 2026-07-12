output "vpc_id" {
  description = "VPC ID."
  value       = aws_vpc.main.id
}

output "primary_subnet_id" {
  description = "The in-use public subnet (AZ 0) for the app instance."
  value       = aws_subnet.public[0].id
}

output "public_subnet_ids" {
  description = "All public subnet IDs (second is reserved for a future ALB)."
  value       = aws_subnet.public[*].id
}

output "web_security_group_id" {
  description = "Security group ID for the web/app host."
  value       = aws_security_group.web.id
}
