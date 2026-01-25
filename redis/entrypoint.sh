#!/bin/sh
# Redis entrypoint - set password from environment variable

# Get Redis password from environment, default to change-in-production
REDIS_PASSWORD=${REDIS_PASSWORD:-redis_password_change_in_production}

# Update redis.conf with the password from environment
sed -i "s/^requirepass .*/requirepass $REDIS_PASSWORD/" /usr/local/etc/redis/redis.conf

# Start Redis server with the config
exec redis-server /usr/local/etc/redis/redis.conf
