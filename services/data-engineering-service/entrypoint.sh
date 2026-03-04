#!/bin/sh
set -e

# Get the GID of the docker socket if it exists
if [ -S /var/run/docker.sock ]; then
    DOCKER_SOCK_GID=$(stat -c "%g" /var/run/docker.sock)
    echo "Docker socket found with GID: $DOCKER_SOCK_GID"
    
    # Get the group name for this GID
    DOCKER_SOCK_GROUP=$(getent group $DOCKER_SOCK_GID | cut -d: -f1)
    echo "Docker socket group: $DOCKER_SOCK_GROUP"
    
    # Add appuser to the socket's group
    if [ -n "$DOCKER_SOCK_GROUP" ]; then
        echo "Adding appuser to group $DOCKER_SOCK_GROUP"
        usermod -aG "$DOCKER_SOCK_GROUP" appuser || true
    fi
fi

# Create and set permissions for execution temp directory
if [ -d /tmp/execution ]; then
    echo "Setting permissions for /tmp/execution"
    chown -R appuser:appuser /tmp/execution
    chmod -R 755 /tmp/execution
fi

# Switch to appuser and execute the command
echo "Starting application as appuser..."
exec su appuser -c "exec $*"
