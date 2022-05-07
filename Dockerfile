FROM python:3.9-slim-buster

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /code

COPY requirements.txt /code/

RUN pip install -r requirements.txt 

EXPOSE 8000

COPY . /code/

# CMD [ "python3 manage.py","runserver" ]