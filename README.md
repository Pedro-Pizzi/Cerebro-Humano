# Robô Clone de WhatsApp com IA (Gemini) 🤖📱

Este projeto é um bot para WhatsApp construído em Node.js usando a biblioteca `whatsapp-web.js` e a inteligência artificial do Google (`@google/generative-ai`). Ele funciona simulando uma aba do WhatsApp Web e responde as mensagens recebidas imitando a sua personalidade e o seu estilo de escrita.

---

## 📋 Pré-requisitos

Antes de começar, você precisa ter instalado no seu computador:

- **[Node.js](https://nodejs.org/en/download/)** (Versão 18 ou superior).
- Um celular com o WhatsApp instalado e conexão à internet.

---

## 🛠️ Passo a Passo da Instalação e Configuração

### 1. Preparando o Ambiente

1. Abra o terminal na pasta do projeto.
2. Se ainda não tiver feito, instale as dependências rodando o comando:
   ```bash
   npm install
   ```

### 2. Configurando sua Chave da IA

O "cérebro" do robô usa a API do Google Gemini.

1. Acesse o [Google AI Studio](https://aistudio.google.com/app/apikey) e faça login com sua conta do Google.
2. Clique no botão azul **"Create API Key"** e copie a chave gerada.
3. Na pasta raiz do projeto, renomeie o arquivo `.env.example` para `.env` (apenas `.env`, sem nenhum nome antes do ponto).
4. Abra o arquivo `.env` com um editor de texto e cole a sua chave:
   ```env
   GEMINI_API_KEY=sua_chave_colada_aqui
   ```

### 3. Restringindo Quem o Robô Pode Responder (Recomendado)

Para evitar que a IA responda seu chefe ou grupos do trabalho, você pode definir uma "Lista Branca" (Whitelist).

1. No mesmo arquivo `.env`, procure por `ALLOWED_NUMBERS`.
2. Adicione os números autorizados com o formato: `DDI` + `DDD` + `Número`.
   - **Exemplo para o Brasil (DDI 55) e SP (DDD 11):** `5511999999999`
3. Se for colocar mais de um, separe por vírgula, sem espaços:
   ```env
   ALLOWED_NUMBERS=5511999999999,5521988888888
   ```
   > **Nota:** Se você deixar essa variável completamente vazia, o robô vai tentar responder **TODO MUNDO** (exceto grupos). Cuidado!

### 4. Ensinando a IA a Ser Você

O grande segredo desse robô é o **System Prompt**.

1. Abra o arquivo `src/persona.ts`.
2. Altere o texto da variável `SYSTEM_PROMPT`. É aqui que você escreve as suas regras pessoais.
   - _Exemplo de ajustes:_ "Você odeia usar vírgulas", "Você sempre usa a gíria 'tlgd'", "Você sempre responde com menos de 10 palavras".

---

## 🚀 Como Ligar o Robô

1. Abra o terminal na pasta do projeto.
2. Digite o seguinte comando e aperte Enter:
   ```bash
   npm run dev
   ```
3. O terminal vai processar por alguns instantes e, em seguida, um **QR Code gigante** vai aparecer na sua tela.
4. Pegue o seu celular:
   - Abra o WhatsApp.
   - Vá em **Configurações** > **Aparelhos Conectados**.
   - Clique em **Conectar um aparelho**.
   - Aponte a câmera do celular para o QR Code no terminal.
5. Aguarde até aparecer a mensagem: `✅ Robô está online e pronto para responder!`.

> **⚠️ Atenção:** A sessão será salva automaticamente na pasta oculta `.wwebjs_auth`. Você não precisará escanear o QR code novamente das próximas vezes que ligar o bot, a menos que você desconecte pelo celular.

---

## 💡 Recursos do Robô

- **Memória de Conversa:** O robô lembra das últimas 20 mensagens trocadas com cada contato para manter o contexto.
- **Ignora Grupos:** Por padrão, o robô é programado para ignorar qualquer mensagem enviada em grupos (para evitar spam).
- **Comando `/reset`:** Se o bot se perder no assunto com algum contato, basta que esse contato mande a mensagem `/reset`. O bot vai apagar a memória daquela conversa e começar do zero.
- **Simulação Humana:** O bot vai enviar o status de _"Digitando..."_ no WhatsApp enquanto pensa na resposta.

---

## 🆘 Resolução de Problemas Comuns

- **Erro: "GEMINI_API_KEY não foi encontrada"**
  - Solução: O seu arquivo `.env` não está salvo corretamente ou está com a extensão errada (ex: `.env.txt`). Certifique-se de que o nome é apenas `.env`.

- **O QR Code apareceu, mas o celular não lê de jeito nenhum:**
  - Solução: Tente aumentar a largura do seu terminal (janela). Se ele estiver muito estreito, o QR Code pode ficar quebrado. Pare o código com `Ctrl+C`, estique a janela e rode `npm run dev` novamente.

- **Erro na hora de instalar (npm install): "puppeteer failed"**
  - Solução: Isso geralmente ocorre pela falta de bibliotecas de navegador no sistema. O `whatsapp-web.js` precisa baixar o Chromium. Tente rodar o comando com permissão de administrador ou verifique se o seu antivírus não bloqueou o download do Chrome.

- **O robô parou de responder do nada:**
  - Solução: Você pode ter estourado o limite gratuito da API do Google Gemini (que é bem generoso, mas existe). Verifique o terminal para ver se há erros do tipo `429 Too Many Requests`.

---

_Desenvolvido com Node.js, whatsapp-web.js e Google Gemini AI._
