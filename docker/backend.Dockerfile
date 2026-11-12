FROM python:3.6-buster

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIPENV_VENV_IN_PROJECT=1

# Archived Debian Buster repositories
RUN printf '%s\n' \
    'deb [check-valid-until=no] http://archive.debian.org/debian buster main' \
    'deb [check-valid-until=no] http://archive.debian.org/debian-security buster/updates main' \
    > /etc/apt/sources.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       default-libmysqlclient-dev \
       pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Legacy Python tooling
RUN python -m pip install \
    "pip<22" \
    "setuptools<60" \
    "pipenv==2018.5.18"

# Install backend dependencies
WORKDIR /app/ydl_api

COPY ydl-api/Pipfile ./
COPY ydl-api/Pipfile.lock ./

# Create the virtual environment explicitly
RUN pipenv --python 3.6

# Older dependencies require setuptools.Feature and use_2to3
RUN pipenv run python -m pip install "setuptools==45.3.0"

# Install dependencies from the existing lockfile
RUN pipenv sync

# Copy application
COPY ydl-api/ ./

EXPOSE 8000

CMD ["pipenv", "run", "python", "ydl_api/manage.py", "runserver", "0.0.0.0:8000"]