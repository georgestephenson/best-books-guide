terraform {
  required_version = ">= 1.12"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Bootstrap uses LOCAL state on purpose: it creates the very S3 bucket that
  # every other config uses as its backend, so it can't use that bucket itself.
  # Applied once by an admin; state stays local (and gitignored). See README.
}
