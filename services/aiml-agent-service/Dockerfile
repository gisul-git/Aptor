FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install and register ipykernel
RUN python -m pip install ipykernel && \
    python -m ipykernel install --user --name python3 --display-name "Python 3"

# Copy main.py first
COPY main.py .

# Copy agent code - maintain agent package structure
RUN mkdir -p /app/agent
COPY agent /app/agent/

# Create uploads directory for file uploads
RUN mkdir -p /app/agent/uploads

# Set PYTHONPATH so agent package can be imported
ENV PYTHONPATH=/app:${PYTHONPATH}

# Expose WebSocket port and HTTP health check port
EXPOSE 8889 8080

# Run the service
WORKDIR /app
CMD ["python", "main.py", "--host", "0.0.0.0", "--port", "8889", "--health-port", "8080"]

