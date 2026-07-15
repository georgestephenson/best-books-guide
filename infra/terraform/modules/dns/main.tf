# The public hosted zone was auto-created when the domain was registered in Route53.
# We look it up (rather than create/import) and only manage records within it — this
# sidesteps the split-brain-zone risk noted in TODO.md.
data "aws_route53_zone" "main" {
  name = var.domain_name
}

resource "aws_route53_record" "apex_a" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 300
  records = [var.eip_ipv4]
}

resource "aws_route53_record" "apex_aaaa" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "AAAA"
  ttl     = 300
  records = [var.instance_ipv6]
}

# www resolves to the host too, so Nginx can 301 it to the apex.
resource "aws_route53_record" "www_a" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [var.eip_ipv4]
}

resource "aws_route53_record" "www_aaaa" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "AAAA"
  ttl     = 300
  records = [var.instance_ipv6]
}

# Only Let's Encrypt may issue certs for this domain.
resource "aws_route53_record" "caa" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "CAA"
  ttl     = 300
  records = ["0 issue \"letsencrypt.org\""]
}
