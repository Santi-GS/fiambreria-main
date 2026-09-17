#!/bin/bash
set -e

echo "=========================================="
echo " Actualizando Fiambrería Costanera POS en Servidor"
echo "=========================================="

echo "-> 1. Descargando última imagen desde GitHub Container Registry..."
docker compose pull

echo "-> 2. Reiniciando contenedores..."
docker compose up -d --remove-orphans

echo "-> 3. Limpiando imágenes antiguas para ahorrar espacio..."
docker image prune -f

echo "-> 4. Estado de los contenedores:"
docker compose ps

echo "=========================================="
echo " ¡Actualización completada exitosamente! "
echo "=========================================="
