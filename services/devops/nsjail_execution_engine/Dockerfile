FROM debian:bookworm-slim

# -------------------------------------------------
# Install build dependencies and runtime tools
# -------------------------------------------------
RUN apt-get update && apt-get install -y \
    bash \
    coreutils \
    util-linux \
    ca-certificates \
    curl \
    git \
    unzip \
    gnupg \
    build-essential \
    pkg-config \
    flex \
    bison \
    libcap-dev \
    libprotobuf-dev \
    protobuf-compiler \
    libnl-3-dev \
    libnl-route-3-dev \
    libseccomp-dev \
    && rm -rf /var/lib/apt/lists/*

# -------------------------------------------------
# Install up-to-date Docker CLI (for host daemon API compatibility)
# -------------------------------------------------
RUN install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && . /etc/os-release \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# -------------------------------------------------
# Build and install NSJail from source
# -------------------------------------------------
RUN git clone --depth 1 https://github.com/google/nsjail.git /tmp/nsjail \
    && make -C /tmp/nsjail \
    && install -m 0755 /tmp/nsjail/nsjail /usr/local/bin/nsjail \
    && rm -rf /tmp/nsjail

# -------------------------------------------------
# Install Terraform (CLI only, no providers)
# -------------------------------------------------
ENV TERRAFORM_VERSION=1.6.6

RUN curl -fsSL \
      https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip \
      -o terraform.zip \
    && unzip terraform.zip \
    && mv terraform /usr/local/bin/terraform \
    && chmod +x /usr/local/bin/terraform \
    && rm terraform.zip


# -------------------------------------------------
# Working directory inside container
# -------------------------------------------------
WORKDIR /sandbox

# -------------------------------------------------
# Copy NSJail config and entrypoint
# Use COPY --chmod to avoid Windows chmod issues
# -------------------------------------------------
COPY --chmod=755 nsjail/entrypoint.sh /entrypoint.sh
COPY nsjail/config.cfg /etc/nsjail.cfg
RUN sed -i 's/\r$//' /entrypoint.sh

# -------------------------------------------------
# Keep container alive for docker exec
# -------------------------------------------------
ENTRYPOINT ["/entrypoint.sh"]
