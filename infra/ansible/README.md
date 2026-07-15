# Ansible

Configures the EC2 host and ships releases. Runs from your machine (or CI) over
SSH; nothing here runs on your laptop as a target.

## Layout

```
site.yml  deploy.yml           # playbooks (kept next to roles/ so they resolve from any CWD)
roles/  common nodejs app nginx monit
inventories/prod/hosts.yml     # the host (set ansible_host to the Elastic IP)
group_vars/all/main.yml        # non-secret config
group_vars/all/vault.yml       # secrets (encrypted; create from vault.yml.example)
```

PostgreSQL, Redis, and backups arrive in M2 (the M1 app has no datastore yet).

## Prerequisites

```bash
cd infra/ansible
ansible-galaxy collection install -r requirements.yml
cp group_vars/all/vault.yml.example group_vars/all/vault.yml   # then edit + encrypt:
ansible-vault encrypt group_vars/all/vault.yml
```

Set `ansible_host` (the EIP) in the inventory and `admin_email` in
`group_vars/all/main.yml`. The host must be reachable on 22 (your `admin_cidr`),
and DNS for the domain must resolve to it before certbot can issue a cert.

## Converge the host

```bash
ansible-playbook site.yml --ask-vault-pass
```

Installs and hardens everything, obtains the Let's Encrypt cert, and leaves the
API service enabled (it starts on the first deploy).

## Deploy a release

```bash
ansible-playbook deploy.yml -e release_sha=<git-sha> --ask-vault-pass
```

Normally run by the `deploy.yml` GitHub Actions workflow. Rolling back is the
same command with a previous SHA.
