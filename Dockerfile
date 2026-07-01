# Use an official Python 3.12-slim base image
FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies (build-essential, curl, git, and media/audio libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set up user for Hugging Face Spaces (UID 1000)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    HF_HOME=/home/user/.cache/huggingface \
    TORCH_HOME=/home/user/.cache/torch

# Set working directory to the user's home folder app directory
WORKDIR $HOME/app

# Install uv (extremely fast Python package installer)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy backend dependencies list first to leverage Docker build cache
COPY --chown=user backend/requirements.txt .

# Install Python packages using uv.
# We do NOT use the CPU-only index here because Hugging Face Spaces offers GPU resources,
# and we want PyTorch to utilize the GPU with CUDA.
RUN uv pip install --user -r requirements.txt

# Pre-download spaCy, SentenceTransformer, and HSEmotion models to cache them in the image
# This ensures that when the Space launches, it starts instantly without downloading models at runtime.
RUN python -c "import spacy; spacy.cli.download('en_core_web_sm')"
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-small-en-v1.5')"
RUN python -c "from hsemotion.facial_emotions import HSEmotionRecognizer; HSEmotionRecognizer(model_name='enet_b2_8', device='cpu')"

# Copy the backend application source code and set ownership to 'user'
COPY --chown=user backend/ .

# Hugging Face Spaces expects the container to run on port 7860
EXPOSE 7860

# Command to run uvicorn on port 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
