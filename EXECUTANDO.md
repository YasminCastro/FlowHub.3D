# Executando o FlowHub.3D

O projeto tem duas aplicações:

| Pasta       | Stack                  | Porta | Gerenciador |
| ----------- | ---------------------- | ----- | ----------- |
| `backend/`  | NestJS + Prisma 7      | 3001  | yarn        |
| `frontend/` | Next.js 16             | 3000  | npm         |

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
FRONTEND_URL=http://localhost:3000

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
yarn start:dev            # http://localhost:3001 (recarrega ao salvar)
```

A documentação da API (Swagger) fica em http://localhost:3001/docs.

### 2. Frontend

Crie o `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Depois:

```bash
cd frontend
npm install
npm run dev               # http://localhost:3000
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

Os arquivos são [docker-compose.yml](docker-compose.yml), [backend/Dockerfile](backend/Dockerfile) e [frontend/Dockerfile](frontend/Dockerfile).

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
NEXT_PUBLIC_API_URL=http://192.168.100.X:3001
FRONTEND_URL=http://192.168.100.X:3000
COOKIE_SECURE=false     # true só se o acesso for por HTTPS
```

**`backend/.env.production`**: banco de produção, segredos JWT e e-mail. Gere segredos novos para produção, não reaproveite os de dev:

```bash
openssl rand -hex 32
```

Os dois arquivos estão no `.gitignore` e não devem ser commitados.

### 2. Subir

```bash
docker compose up -d --build
```

- Frontend: `http://<ip-do-servidor>:3000`
- API: `http://<ip-do-servidor>:3001` (Swagger em `/docs`)

As migrations do Prisma (`prisma migrate deploy`) rodam sozinhas toda vez que o container do backend inicia. Os containers voltam a subir sozinhos se o servidor reiniciar (`restart: unless-stopped`).

### 3. Atualizar para uma nova versão

```bash
git pull
docker compose up -d --build
```

> O `NEXT_PUBLIC_API_URL` é embutido no frontend **durante o build**. Se ele mudar no `.env`, é obrigatório rodar com `--build`.

### Operação do dia a dia

| Comando                                   | O que faz                                    |
| ----------------------------------------- | -------------------------------------------- |
| `docker compose ps`                       | Status dos containers                        |
| `docker compose logs -f backend`          | Acompanha os logs do backend                 |
| `docker compose restart backend`          | Reinicia só o backend                        |
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
NEXT_PUBLIC_API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
COOKIE_SECURE=false
```

Depois rode `docker compose up --build`. Antes, pare o `start:dev` e o `npm run dev`, porque eles usam as mesmas portas.
