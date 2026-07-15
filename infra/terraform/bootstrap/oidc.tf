data "aws_caller_identity" "current" {}

# Fetch GitHub's OIDC signing cert so we pin the provider thumbprint dynamically
# rather than hard-coding a fingerprint that rotates.
data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

# GitHub Actions federates into AWS via OIDC — no long-lived access keys anywhere
# in CI (docs/05 §Platform & pipeline security).
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

resource "aws_iam_role" "github_actions" {
  name        = "${var.project}-github-actions"
  description = "Assumed by GitHub Actions (this repo only) via OIDC to deploy releases."

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        # Locked to this repository. Tighten to a branch/environment later, e.g.
        # "repo:${var.github_repo}:ref:refs/heads/main" or ":environment:production".
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:*"
        }
      }
    }]
  })
}

# M1 scope: CI only uploads build artifacts to the releases bucket; the EC2 host
# pulls them via its own instance role. Terraform apply stays local (admin) for
# now, so this role deliberately does NOT get broad infra permissions.
resource "aws_iam_role_policy" "github_actions_releases" {
  name = "deploy-release-artifacts"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ListReleaseBucket"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = ["arn:aws:s3:::${var.bucket_prefix}-releases"]
      },
      {
        Sid      = "WriteReleaseArtifacts"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject"]
        Resource = ["arn:aws:s3:::${var.bucket_prefix}-releases/*"]
      }
    ]
  })
}

# The deploy reaches the host by tunnelling SSH over SSM — no inbound port 22,
# and no IP allowlist for GitHub's dynamic runners (docs/06).
resource "aws_iam_role_policy" "github_actions_ssm" {
  name = "deploy-over-ssm"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "StartSshSession"
        Effect = "Allow"
        Action = ["ssm:StartSession"]
        Resource = [
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/*",
          "arn:aws:ssm:${var.aws_region}::document/AWS-StartSSHSession",
        ]
      },
      {
        Sid      = "ManageOwnSessions"
        Effect   = "Allow"
        Action   = ["ssm:TerminateSession", "ssm:ResumeSession"]
        Resource = "arn:aws:ssm:*:*:session/*"
      },
      {
        Sid      = "DiscoverInstances"
        Effect   = "Allow"
        Action   = ["ssm:DescribeInstanceInformation"]
        Resource = "*"
      },
    ]
  })
}
