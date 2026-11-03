# Executando o FlowHub.3D

O projeto tem duas aplicações:

| Pasta       | Stack                  | Porta | Gerenciador |
| ----------- | ---------------------- | ----- | ----------- |
| `backend/`  | NestJS + Prisma 7      | 3008  | yarn        |
| `frontend/` | Next.js 16             | 3009  | npm         |

O banco é PostgreSQL e roda fora deste repositório, tanto em desenvolvimento quanto em produção.

- [Desenvolvimento local](#desenvolvimento-local)
- [Produção com Docker](#produção-com-docker)

---

## Desenvolvimento local

### Pré-requisitos

- Node.js 24
- Yarn 1 (`npm install -g yarn`)
- Acesso a um PostgreSQL (o de desenvolvimento ou um local)

### 1. Backend

Crie o `backend/.env`. O modelo [backend/.env.production.example](backend/.env.production.example) mostra as variáveis necessárias:

```env
DATABASE_URL="postgresql://USUARIO:SENHA@192.168.100.51:5432/flowhub-dev?schema=public"
JWT_SECRET=qualquer-coisa-em-dev
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=outra-coisa-em-dev
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3009

MAIL_HOST=
MAIL_PORT=
MAIL_USER=
MAIL_PASSWORD=
MAIL_FROM=
```

Depois instale as dependências e suba a aplicação:

```bash
cd backend
yarn install
yarn prisma generate      # gera o client em src/generated/prisma (fora do git)
yarn prisma migrate dev   # aplica as migrations no banco de dev
yarn start:dev            # http://localhost:3008 (recarrega ao salvar)
```

A documentação da API (Swagger) fica em http://localhost:3008/docs.

### 2. Frontend

Crie o `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3008
```

Depois:

```bash
cd frontend
npm install
npm run dev               # http://localhost:3009
```

### Comandos úteis

| Onde       | Comando                                  | O que faz                                    |
| ---------- | ---------------------------------------- | -------------------------------------------- |
| `backend`  | `yarn test`                              | Testes unitários                             |
| `backend`  | `yarn lint`                              | ESLint (com `--fix`)                         |
| `backend`  | `yarn prisma migrate dev --name <nome>`  | Cria uma migration após alterar o `schema.prisma` |
| `backend`  | `yarn prisma studio`                     | Abre uma interface para ver e editar o banco |
| `frontend` | `npm run lint`                           | ESLint                                       |

> Sempre que o `schema.prisma` mudar (inclusive depois de um `git pull`), rode `yarn prisma generate` de novo.

---

## Produção com Docker

Os arquivos são [docker-compose.yml](docker-compose.yml), [Caddyfile](Caddyfile), [backend/Dockerfile](backend/Dockerfile) e [frontend/Dockerfile](frontend/Dockerfile).

O acesso é por HTTPS: o container `caddy` recebe as conexões nas portas 3008 e 3009 e repassa para o backend e o frontend. Como não há domínio público, o Caddy usa uma autoridade certificadora (CA) própria, e o certificado raiz dela precisa ser instalado nas máquinas que acessam o sistema (ver [Certificado HTTPS](#certificado-https)).

### Pré-requisitos

- Docker Engine com o plugin Compose (`docker compose version`)
- Acesso do servidor ao PostgreSQL de produção

### 1. Configuração (só na primeira vez)

```bash
git clone <url-do-repositório> flowhub.3d
cd flowhub.3d

cp .env.example .env
cp backend/.env.production.example backend/.env.production
```

**`.env`** (raiz): endereços que os navegadores usam para acessar o servidor. Troque `192.168.100.X` pelo IP ou hostname do servidor:

```env
SERVER_HOST=192.168.100.X
NEXT_PUBLIC_API_URL=https://192.168.100.X:3008
FRONTEND_URL=https://192.168.100.X:3009
COOKIE_SECURE=true
```

O `SERVER_HOST` é o endereço para o qual o certificado é emitido. Ele precisa ser exatamente o que os usuários digitam no navegador.

**`backend/.env.production`**: banco de produção, segredos JWT e e-mail. Gere segredos novos para produção, não reaproveite os de dev:

```bash
openssl rand -hex 32
```

Os dois arquivos estão no `.gitignore` e não devem ser commitados.

### 2. Subir

```bash
docker compose up -d --build
```

- Frontend: `https://<ip-do-servidor>:3009`
- API: `https://<ip-do-servidor>:3008` (Swagger em `/docs`)

Acessar por `http://` nessas portas não funciona mais: use sempre `https://`.

As migrations do Prisma (`prisma migrate deploy`) rodam sozinhas toda vez que o container do backend inicia. Os containers voltam a subir sozinhos se o servidor reiniciar (`restart: unless-stopped`).

### 3. Atualizar para uma nova versão

```bash
git pull
docker compose up -d --build
```

> O `NEXT_PUBLIC_API_URL` é embutido no frontend **durante o build**. Se ele mudar no `.env`, é obrigatório rodar com `--build`.

### Certificado HTTPS

Na primeira vez que sobe, o Caddy gera a CA interna e guarda no volume `flowhub3d_caddy_data`. Copie o certificado raiz para fora do container:

```bash
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./flowhub-ca.crt
```

Instale o `flowhub-ca.crt` em **cada máquina** que acessa o sistema (só uma vez por máquina):

- **Windows**: dê dois cliques no arquivo → *Instalar Certificado* → *Máquina Local* → *Colocar todos os certificados no repositório a seguir* → *Autoridades de Certificação Raiz Confiáveis*. Reabra o navegador.
- **Linux (Debian/Ubuntu)**:
  ```bash
  sudo cp flowhub-ca.crt /usr/local/share/ca-certificates/
  sudo update-ca-certificates
  ```
- **Firefox**: usa o próprio repositório. Em *Configurações → Privacidade e Segurança → Certificados → Ver certificados → Autoridades → Importar*, marque "Confiar nesta CA para identificar sites".
- **Android/iOS**: envie o arquivo para o aparelho e instale como certificado de CA nas configurações de segurança.

O certificado raiz vale por 10 anos. Os certificados do site são renovados sozinhos pelo Caddy, sem precisar reinstalar nada.

> **Não apague o volume `flowhub3d_caddy_data`** (por exemplo com `docker compose down -v`). Se ele sumir, o Caddy gera uma CA nova e o certificado precisa ser reinstalado em todas as máquinas. Vale incluir o `flowhub-ca.crt` e esse volume no backup.

Se o IP do servidor mudar, atualize `SERVER_HOST`, `NEXT_PUBLIC_API_URL` e `FRONTEND_URL` no `.env` e rode `docker compose up -d --build`. A CA continua a mesma, então não precisa reinstalar o certificado.

### Operação do dia a dia

| Comando                                   | O que faz                                    |
| ----------------------------------------- | -------------------------------------------- |
| `docker compose ps`                       | Status dos containers                        |
| `docker compose logs -f backend`          | Acompanha os logs do backend                 |
| `docker compose restart backend`          | Reinicia só o backend                        |
| `docker compose logs -f caddy`            | Logs do HTTPS (certificados, conexões)       |
| `docker compose down`                     | Para tudo (os uploads são mantidos)          |
| `docker compose exec backend sh`          | Abre um shell dentro do container            |

### Uploads (fotos)

As fotos enviadas ficam no volume Docker `flowhub3d_uploads`, que sobrevive a `down` e a rebuilds. **Não use `docker compose down -v`**, porque o `-v` apaga esse volume.

Backup:

```bash
docker run --rm -v flowhub3d_uploads:/data -v "$PWD":/backup busybox \
  tar czf /backup/uploads-$(date +%F).tgz -C /data .
```

Restauração:

```bash
docker run --rm -v flowhub3d_uploads:/data -v "$PWD":/backup busybox \
  tar xzf /backup/uploads-AAAA-MM-DD.tgz -C /data
```

O banco fica fora do Docker, então o backup dele é feito separadamente (ex.: `pg_dump`).

### Testar o Docker no Windows

Com o Docker Desktop aberto, crie um `.env` na raiz apontando para `localhost`:

```env
SERVER_HOST=localhost
NEXT_PUBLIC_API_URL=https://localhost:3008
FRONTEND_URL=https://localhost:3009
COOKIE_SECURE=true
```

Depois rode `docker compose up --build`. O navegador vai avisar que a conexão não é segura até você instalar o certificado raiz (ver [Certificado HTTPS](#certificado-https)). Antes, pare o `start:dev` e o `npm run dev`, porque eles usam as mesmas portas.
