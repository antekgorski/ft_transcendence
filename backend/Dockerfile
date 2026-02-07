# Backend Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install only necessary system dependencies
# gcc is required for some Python packages (psycopg2-binary)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies with no cache to reduce image size
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Default command (overridden by docker-compose)
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "project_config.asgi:application"]
