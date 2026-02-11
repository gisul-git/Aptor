# QA Deployment Setup Guide

This guide explains how to set up automatic deployment to your Debian VM when code is merged from `dev` to `QA` branch.

## Overview

We've created separate GitHub Actions workflows for QA deployment that:
- Trigger automatically when code is pushed to `QA` branch (or merged via PR)
- Deploy to your Debian VM using SSH
- Use Docker Compose to manage all services

## Workflows Created

1. **`deploy-qa.yml`** - Main workflow that deploys all services via docker-compose
2. **`deploy-qa-frontend.yml`** - Frontend-specific deployment
3. **`deploy-qa-api-gateway.yml`** - API Gateway deployment
4. **`deploy-qa-auth-service.yml`** - Auth Service deployment
5. **`deploy-qa-custom-mcq-service.yml`** - Custom MCQ Service deployment
6. **`deploy-qa-ai-assessment-service.yml`** - AI Assessment Service deployment
7. **`deploy-qa-dsa-service.yml`** - DSA Service deployment
8. **`deploy-qa-proctoring-service.yml`** - Proctoring Service deployment
9. **`deploy-qa-super-admin-service.yml`** - Super Admin Service deployment
10. **`deploy-qa-aiml-service.yml`** - AIML Service deployment
11. **`deploy-qa-employee-service.yml`** - Employee Service deployment

## GitHub Secrets Required

You need to configure the following secrets in your GitHub repository:

1. **`QA_VM_HOST`** - IP address or hostname of your Debian VM
   - Example: `192.168.1.100` or `qa-server.example.com`

2. **`QA_VM_USER`** - SSH username for the VM
   - Example: `deploy` or `ubuntu`

3. **`QA_VM_SSH_KEY`** - Private SSH key for authentication
   - Generate with: `ssh-keygen -t ed25519 -C "github-actions-qa"`
   - Copy the **private key** content (including `-----BEGIN` and `-----END` lines)
   - Add the **public key** to the VM: `~/.ssh/authorized_keys`

4. **`QA_VM_DEPLOY_PATH`** (Optional) - Path on VM where code is deployed
   - Default: `/opt/aptor`
   - Example: `/home/deploy/aptor`

## VM Prerequisites

Your Debian VM must have:

1. **Git** installed
   ```bash
   sudo apt update
   sudo apt install git -y
   ```

2. **Docker** and **Docker Compose** installed
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # Install Docker Compose
   sudo apt install docker-compose -y
   # OR for newer versions:
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

3. **SSH Access** configured
   - SSH key-based authentication set up
   - User has sudo privileges (if needed)
   - Firewall allows SSH connections

4. **Git Repository** cloned on the VM
   ```bash
   cd /opt/aptor  # or your chosen path
   git clone <your-repo-url> .
   git checkout QA
   ```

5. **Environment Variables** configured
   - Create `.env` file in the deployment directory
   - Include all required environment variables for services

## Initial VM Setup Steps

1. **Create deployment directory:**
   ```bash
   sudo mkdir -p /opt/aptor
   sudo chown $USER:$USER /opt/aptor
   ```

2. **Clone repository:**
   ```bash
   cd /opt/aptor
   git clone <your-repo-url> .
   git checkout QA
   ```

3. **Set up environment file:**
   ```bash
   cp .env.example .env  # If you have an example file
   # Edit .env with your configuration
   nano .env
   ```

4. **Set up SSH key for GitHub Actions:**
   ```bash
   # On your local machine, generate SSH key
   ssh-keygen -t ed25519 -C "github-actions-qa" -f ~/.ssh/github_qa_deploy
   
   # Copy public key to VM
   ssh-copy-id -i ~/.ssh/github_qa_deploy.pub user@vm-host
   
   # Copy private key content to GitHub Secret QA_VM_SSH_KEY
   cat ~/.ssh/github_qa_deploy
   ```

5. **Test SSH connection:**
   ```bash
   ssh -i ~/.ssh/github_qa_deploy user@vm-host
   ```

## How It Works

### Automatic Deployment Flow

1. **Merge/Push to QA branch** → GitHub Actions triggers
2. **Workflow runs** → Checks out QA branch code
3. **SSH to VM** → Connects using configured credentials
4. **Pull latest code** → `git pull origin QA` on VM
5. **Rebuild containers** → `docker-compose build`
6. **Restart services** → `docker-compose up -d`
7. **Verify deployment** → Checks container status

### Service-Specific Workflows

Individual service workflows:
- Only trigger when that specific service's code changes
- Rebuild and restart only that service (using `--no-deps` flag)
- Faster deployments for single-service updates

### Main Workflow

The main `deploy-qa.yml` workflow:
- Deploys all services together
- Useful for initial setup or when multiple services change
- Rebuilds everything from scratch

## Testing the Deployment

1. **Manual trigger:**
   - Go to GitHub Actions tab
   - Select any QA workflow
   - Click "Run workflow" → Select QA branch → Run

2. **Test with a small change:**
   - Make a small change in `dev` branch
   - Create PR to merge into `QA`
   - Merge the PR
   - Watch the workflow execute

3. **Verify on VM:**
   ```bash
   ssh user@vm-host
   cd /opt/aptor
   docker-compose ps
   ```

## Troubleshooting

### Workflow fails at SSH connection
- Verify `QA_VM_HOST`, `QA_VM_USER`, and `QA_VM_SSH_KEY` secrets are correct
- Test SSH connection manually
- Check VM firewall settings

### Workflow fails at git pull
- Ensure repository is cloned on VM
- Check git remote URL is correct
- Verify user has read access to repository

### Containers fail to start
- Check `.env` file exists and has all required variables
- Review `docker-compose logs` on VM
- Verify Docker and Docker Compose are installed correctly

### Permission errors
- Ensure deployment user has necessary permissions
- Check Docker group membership: `sudo usermod -aG docker $USER`

## Notes

- The workflows use `docker-compose build --no-cache` for clean builds
- Old containers are stopped gracefully before new ones start
- Docker system prune runs to free up space (optional, can be removed)
- All workflows support manual triggering via `workflow_dispatch`

## Next Steps

1. Configure GitHub Secrets
2. Set up your Debian VM with prerequisites
3. Test with a manual workflow run
4. Merge a small change from `dev` to `QA` to test automatic deployment

