FROM redis:7-alpine

# Copy custom configuration file
COPY redis.conf /usr/local/etc/redis/redis.conf

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Start Redis via entrypoint (which sets password from env var)
ENTRYPOINT ["/entrypoint.sh"]
