FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install httpx first with exact version to prevent dependency resolution from upgrading it
# This ensures httpx 0.27.2 is installed before openai tries to pull in a newer version
RUN pip install --no-cache-dir --force-reinstall httpx==0.27.2

# Install other packages - httpx version is already fixed, so it won't be upgraded
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 3002

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3002", "--timeout-keep-alive", "300"]

