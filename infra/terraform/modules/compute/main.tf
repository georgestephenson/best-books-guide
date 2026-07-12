data "aws_caller_identity" "current" {}

# Latest Ubuntu 24.04 LTS (Noble) arm64 image from Canonical.
data "aws_ami" "ubuntu" {
  count       = var.ami_id == null ? 1 : 0
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd*/ubuntu-noble-24.04-arm64-server-*"]
  }
  filter {
    name   = "architecture"
    values = ["arm64"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

locals {
  ami_id           = var.ami_id != null ? var.ami_id : data.aws_ami.ubuntu[0].id
  ses_identity_arn = "arn:aws:ses:${var.aws_region}:${data.aws_caller_identity.current.account_id}:identity/${var.domain_name}"
}

resource "aws_key_pair" "admin" {
  key_name   = "${var.project}-admin"
  public_key = var.ssh_public_key
}

# Instance role — S3 read/write on backups+media, read on releases, and SES send.
# Nothing else (docs/06 §EC2 host).
resource "aws_iam_role" "instance" {
  name = "${var.project}-instance"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "instance" {
  name = "app-access"
  role = aws_iam_role.instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "BackupsMediaReadWrite"
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [
          var.backups_bucket_arn, "${var.backups_bucket_arn}/*",
          var.media_bucket_arn, "${var.media_bucket_arn}/*",
        ]
      },
      {
        Sid      = "ReleasesReadOnly"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:ListBucket"]
        Resource = [var.releases_bucket_arn, "${var.releases_bucket_arn}/*"]
      },
      {
        Sid      = "SesSend"
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = local.ses_identity_arn
      },
    ]
  })
}

resource "aws_iam_instance_profile" "instance" {
  name = "${var.project}-instance"
  role = aws_iam_role.instance.name
}

resource "aws_instance" "app" {
  ami                     = local.ami_id
  instance_type           = var.instance_type
  subnet_id               = var.subnet_id
  vpc_security_group_ids  = [var.security_group_id]
  key_name                = aws_key_pair.admin.key_name
  iam_instance_profile    = aws_iam_instance_profile.instance.name
  ipv6_address_count      = 1
  disable_api_termination = true # termination protection (docs/06)

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_gb
    encrypted             = true
    delete_on_termination = false
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required" # IMDSv2 only
  }

  tags = { Name = "${var.project}-app" }

  # Don't replace the running host just because a newer Ubuntu AMI published;
  # OS upgrades are a deliberate rebuild (docs/06 §EC2 host, TODO).
  lifecycle {
    ignore_changes = [ami]
  }
}

resource "aws_eip" "app" {
  domain = "vpc"
  tags   = { Name = "${var.project}-eip" }
}

resource "aws_eip_association" "app" {
  instance_id   = aws_instance.app.id
  allocation_id = aws_eip.app.id
}
