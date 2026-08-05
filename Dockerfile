FROM mirror.gcr.io/library/nginx:alpine

# Копируем Nginx конфиг
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Копируем уже собранные Angular статические файлы
COPY dist/minecraft-site/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
