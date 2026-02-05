# =========================================================
# Base image
# =========================================================
FROM python:3.12-slim

# =========================================================
# System dependencies
# =========================================================
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# =========================================================
# Working directory
# =========================================================
WORKDIR /app

# =========================================================
# Install hadolint
# =========================================================
RUN curl -L https://github.com/hadolint/hadolint/releases/latest/download/hadolint-Linux-x86_64 \
    -o /usr/local/bin/hadolint \
    && chmod +x /usr/local/bin/hadolint

# =========================================================
# Install kubeconform
# =========================================================
RUN curl -L https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz \
    | tar xz \
    && mv kubeconform /usr/local/bin/kubeconform \
    && chmod +x /usr/local/bin/kubeconform

# =========================================================
# Install actionlint
# =========================================================
RUN curl -L https://github.com/rhysd/actionlint/releases/latest/download/actionlint_linux_amd64 \
    -o /usr/local/bin/actionlint \
    && chmod +x /usr/local/bin/actionlint


# =========================================================
# Python dependencies
# =========================================================
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# =========================================================
# Application source code
# =========================================================
COPY . .

# =========================================================
# Environment variables (paths to linters)
# =========================================================
ENV HADOLINT_PATH=/usr/local/bin/hadolint
ENV KUBECONFORM_PATH=/usr/local/bin/kubeconform
ENV ACTIONLINT_PATH=/usr/local/bin/actionlint

# =========================================================
# Expose port
# =========================================================
EXPOSE 8000

# =========================================================
# Run FastAPI with Gunicorn (production)
# =========================================================
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "linting_engine.main:app", "--bind", "0.0.0.0:8000", "--workers", "4"]

