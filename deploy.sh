#!/bin/bash

# Load deployment configuration
CONFIG_FILE=".deploy_config"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
else
    echo "Error: $CONFIG_FILE file not found!"
    echo "Please create it with: SSH_USER, SSH_HOST, SSH_PORT, SSH_PASS (optional), DOCKER_HUB_USER"
    exit 1
fi

# Stop script on any error
set -e

# Load production environment variables (for validation only, not used for remote execution intentionally)
ENV_FILE="prod.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE file not found!"
    echo "Please copy .env.example to $ENV_FILE and fill in production credentials."
    exit 1
fi

# Check for sshpass if password is provided
if [ -n "$SSH_PASS" ] && ! command -v sshpass &> /dev/null; then
    echo "Error: sshpass is not installed but SSH_PASS is set."
    echo "Please install it with: sudo apt install sshpass"
    exit 1
fi

# Helper function to run remote commands
run_ssh() {
    if [ -n "$SSH_PASS" ]; then
        sshpass -p "$SSH_PASS" ssh -p "$SSH_PORT" -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "$1"
    else
        ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "$1"
    fi
}

# Helper function to run scp
run_scp() {
    SRC=$1
    DEST=$2
    if [ -n "$SSH_PASS" ]; then
        sshpass -p "$SSH_PASS" scp -P "$SSH_PORT" -o StrictHostKeyChecking=no "$SRC" "$SSH_USER@$SSH_HOST:$DEST"
    else
        scp -P "$SSH_PORT" "$SRC" "$SSH_USER@$SSH_HOST:$DEST"
    fi
}

echo "========================================"
echo "Deploying to $SSH_HOST as $SSH_USER"
echo "Docker Hub User: $DOCKER_HUB_USER"
echo "========================================"

# 1. Build and Tag Images
echo "[1/4] Building and Tagging Images..."
docker build -t "$DOCKER_HUB_USER/ft_transcendence_nginx:latest" ./nginx
docker build -t "$DOCKER_HUB_USER/ft_transcendence_redis:latest" ./redis
docker build -t "$DOCKER_HUB_USER/ft_transcendence_backend:latest" ./backend
docker build -t "$DOCKER_HUB_USER/ft_transcendence_frontend:latest" ./frontend

# 2. Push Images to Docker Hub
echo "[2/4] Pushing Images to Docker Hub..."
docker push "$DOCKER_HUB_USER/ft_transcendence_nginx:latest"
docker push "$DOCKER_HUB_USER/ft_transcendence_redis:latest"
docker push "$DOCKER_HUB_USER/ft_transcendence_backend:latest"
docker push "$DOCKER_HUB_USER/ft_transcendence_frontend:latest"

# 3. Copy Configuration to Remote Server
echo "[3/4] Copying Configuration to Remote Server..."
# Ensure directory exists
run_ssh "mkdir -p $REMOTE_PATH"

# Copy files
run_scp "docker-compose.prod.yml" "$REMOTE_PATH/docker-compose.prod.yml"
run_scp "nginx/nginx.prod.conf" "$REMOTE_PATH/nginx.prod.conf"
run_scp "prod.env" "$REMOTE_PATH/prod.env"

# 4. Deploy on Remote Server
echo "[4/4] Deploying on Remote Server..."
DEPLOY_CMD="
    cd $REMOTE_PATH
    
    # Copy prod.env to .env so docker-compose picks up variables automatically for substitution
    # We MUST keep prod.env because it is referenced in docker-compose.prod.yml
    cp prod.env .env

    # Export Docker Hub User for compose file interpolation
    export DOCKER_HUB_USER=$DOCKER_HUB_USER

    echo 'Stopping existing containers...'
    docker-compose -f docker-compose.prod.yml down
    
    # Force remove containers by name to ensure no conflicts from previous runs/orphans
    echo 'Force removing potential conflicting containers...'
    docker rm -f ft_transcendence_nginx ft_transcendence_redis ft_transcendence_backend ft_transcendence_frontend || true

    echo 'Pruning unused docker objects...'
    docker system prune -f

    echo 'Pulling latest images...'
    docker-compose -f docker-compose.prod.yml pull

    echo 'Starting containers...'
    docker-compose -f docker-compose.prod.yml up -d

    echo 'Running database migrations...'
    docker-compose -f docker-compose.prod.yml exec -T backend python manage.py migrate

"

run_ssh "$DEPLOY_CMD"

echo "========================================"
echo "Deployment Complete!"
echo "========================================"
