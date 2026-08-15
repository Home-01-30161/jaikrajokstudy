FROM searxng/searxng:latest

# Bake the JSON-enabled config into the image so no host bind mount is
# needed. The deploy runner never copies repo files onto the host, so a
# bind mount would leave SearXNG running with defaults (JSON disabled).
COPY settings.yml /etc/searxng/settings.yml
