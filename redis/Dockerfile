FROM redis:7-alpine

# Copy custom configuration file
COPY redis.conf /usr/local/etc/redis/redis.conf

# Start Redis with the custom config
CMD ["redis-server", "/usr/local/etc/redis/redis.conf"]
