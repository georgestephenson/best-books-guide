# Production environment. Module order follows the dependency chain:
# storage → compute → dns → email (no cycles; compute builds the SES ARN from a
# string rather than depending on the email module).

module "network" {
  source = "../../modules/network"

  project    = var.project
  aws_region = var.aws_region
}

module "storage" {
  source = "../../modules/storage"

  bucket_prefix = var.bucket_prefix
}

module "compute" {
  source = "../../modules/compute"

  project           = var.project
  aws_region        = var.aws_region
  instance_type     = var.instance_type
  subnet_id         = module.network.primary_subnet_id
  security_group_id = module.network.web_security_group_id
  ssh_public_key    = var.ssh_public_key

  backups_bucket_arn  = module.storage.backups_bucket_arn
  media_bucket_arn    = module.storage.media_bucket_arn
  releases_bucket_arn = module.storage.releases_bucket_arn
}

module "dns" {
  source = "../../modules/dns"

  domain_name   = var.domain_name
  eip_ipv4      = module.compute.public_ip
  instance_ipv6 = module.compute.public_ipv6
}

module "email" {
  source = "../../modules/email"

  project            = var.project
  aws_region         = var.aws_region
  domain_name        = var.domain_name
  zone_id            = module.dns.zone_id
  dmarc_report_email = var.alert_email
}
