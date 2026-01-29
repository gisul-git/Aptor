FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    coreutils \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash coderunner && \
    mkdir -p /code /tmp/workdir && \
    chown -R coderunner:coderunner /code /tmp/workdir

# Security limits
RUN echo "coderunner soft nproc 50" >> /etc/security/limits.conf && \
    echo "coderunner hard nproc 50" >> /etc/security/limits.conf

USER coderunner
WORKDIR /code

CMD ["/bin/bash"]

