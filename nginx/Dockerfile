FROM nginx:alpine

# Install openssl and generate a self-signed cert inside the container
RUN apk add --no-cache openssl \
	&& mkdir -p /etc/nginx/ssl \
	&& openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout /etc/nginx/ssl/localhost.key \
		-out /etc/nginx/ssl/localhost.crt \
		-subj "/CN=localhost"

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 443
# EXPOSE 80

# Start nginx (default command)
CMD ["nginx", "-g", "daemon off;"]
