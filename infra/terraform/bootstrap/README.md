# Terraform bootstrap

Applied **once, locally, by an admin** — before `envs/prod`. It creates the things
the rest of the infra depends on but can't create for itself:

- **`bestbooks-terraform-state`** — the S3 bucket every other config uses as its
  remote-state backend (versioned, encrypted, native `use_lockfile` locking — no DynamoDB).
- **GitHub Actions OIDC provider + role** — so CI deploys with no long-lived AWS keys
  ([docs/05](../../../docs/05-security.md)). M1 scope: upload release artifacts to S3 only.
- **Monthly cost budget** — email alerts at 80% actual / 100% forecast ([docs/06](../../../docs/06-infrastructure.md)).

## Why local state

Bootstrap creates the state bucket, so it can't store its own state there. It uses
**local state**, applied once and rarely changed. The `.tfstate` is gitignored; if it's
lost, `terraform import` re-adopts these stable resources.

## Apply

Prerequisites: Terraform ≥ 1.12 and AWS admin credentials in your shell
(`aws sts get-caller-identity` should show your account).

```bash
cd infra/terraform/bootstrap
cp terraform.tfvars.example terraform.tfvars   # set budget_notify_email
terraform init
terraform plan
terraform apply
```

## After apply

Note the outputs — they wire up the next layer:

| Output | Used by |
|---|---|
| `state_bucket` | `envs/prod` backend `bucket` |
| `github_actions_role_arn` | `AWS_ROLE_ARN` repo variable for the deploy workflow |
| `oidc_provider_arn` / `account_id` | reference when scoping later policies |

Then continue with [`../envs/prod`](../envs/prod) (created next).

## Teardown

The state bucket has `prevent_destroy = true`. To dismantle everything, first
`terraform destroy` in `envs/prod`, then remove that lifecycle block here and
`terraform destroy` bootstrap last.
