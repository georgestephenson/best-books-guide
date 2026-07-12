variable "domain_name" {
  description = "Apex domain, e.g. bestbooks.guide. Its hosted zone already exists (created at registration) and is looked up, not created."
  type        = string
}

variable "eip_ipv4" {
  description = "Elastic IP (IPv4) for the apex/www A records."
  type        = string
}

variable "instance_ipv6" {
  description = "Instance IPv6 address for the apex/www AAAA records."
  type        = string
}
