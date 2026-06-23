FROM ghcr.io/puppeteer/puppeteer:latest

# Define variaveis de ambiente pro Puppeteer rodar suave no Railway
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV WA_HEADLESS=true
ENV PORT=4000

USER root

# Cria a pasta e da permissao
WORKDIR /app
COPY package*.json ./
# Instala dependencias para compilar modulos C++ e força a compilação do sqlite3
RUN apt-get update && apt-get install -y python3 build-essential
RUN npm install --build-from-source=sqlite3

# Copia o restante dos arquivos
COPY . .

# Compila o dashboard (Frontend)
WORKDIR /app/dashboard
RUN npm install
RUN npm run build

# Volta pro backend e compila (se necessario)
WORKDIR /app
RUN npm run build || true

# Como o Railway zera o disco a cada deploy, o banco de dados sqlite
# sera limpo. Se quiser manter, configure um Volume no Railway na pasta /app/brain.sqlite

EXPOSE 4000
CMD ["npm", "run", "dev"]
