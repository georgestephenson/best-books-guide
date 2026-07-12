# SES sending identity for transactional mail (verification, password reset) and
# Monit alerts (docs/06 §SES). Sandbox-exit is a manual console request (TODO).

resource "aws_ses_domain_identity" "main" {
  domain = var.domain_name
}

# Domain-verification TXT record (Route53 auto-verifies once this propagates).
resource "aws_route53_record" "verification" {
  zone_id = var.zone_id
  name    = "_amazonses.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.main.verification_token]
}

resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

# Easy DKIM: three CNAMEs pointing at Amazon's signing keys.
resource "aws_route53_record" "dkim" {
  count   = 3
  zone_id = var.zone_id
  name    = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.main.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# Custom MAIL FROM so SPF aligns with our domain.
resource "aws_ses_domain_mail_from" "main" {
  domain           = aws_ses_domain_identity.main.domain
  mail_from_domain = "${var.mail_from_subdomain}.${var.domain_name}"
}

resource "aws_route53_record" "mail_from_mx" {
  zone_id = var.zone_id
  name    = aws_ses_domain_mail_from.main.mail_from_domain
  type    = "MX"
  ttl     = 600
  records = ["10 feedback-smtp.${var.aws_region}.amazonses.com"]
}

resource "aws_route53_record" "mail_from_spf" {
  zone_id = var.zone_id
  name    = aws_ses_domain_mail_from.main.mail_from_domain
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

# Start at p=none (monitor), tighten to quarantine after a clean sending month (TODO).
resource "aws_route53_record" "dmarc" {
  zone_id = var.zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = ["v=DMARC1; p=none; rua=mailto:${var.dmarc_report_email}"]
}

# The one static credential in the system (docs/05): a send-only SMTP user for Monit
# alerts. Terraform derives the region-specific SMTP password; store both in Ansible Vault.
resource "aws_iam_user" "monit_smtp" {
  name = "${var.project}-monit-smtp"
}

resource "aws_iam_user_policy" "monit_smtp" {
  name = "ses-send-raw"
  user = aws_iam_user.monit_smtp.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ses:SendRawEmail"]
      Resource = "*"
    }]
  })
}

resource "aws_iam_access_key" "monit_smtp" {
  user = aws_iam_user.monit_smtp.name
}
