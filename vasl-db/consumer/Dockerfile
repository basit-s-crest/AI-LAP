# ============================================================
# Kafka consumer service
# Non-root user required (matches production spec Section 9.3)
# ============================================================

FROM python:3.11-slim

# Non-root user
RUN useradd -m -u 1000 vasl

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

USER vasl

CMD ["python", "consumer.py"]
