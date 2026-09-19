# OpticNoteBook

O **OpticNoteBook** é um sistema de agendamentos desenvolvido com backend em **Python/Django** e frontend em **React**.

## Tecnologias

### Backend

* Python 3.12.10
* Django
* Django REST Framework
* PostgreSQL

### Frontend

* React 19
* Vite 8
* TypeScript 6
* Tailwind CSS 4

## Requisitos

Antes de iniciar o projeto, tenha instalado:

* Python 3.12.10
* Node.js
* npm
* PostgreSQL
* Git

## Como rodar o projeto

### 1. Clone o repositório

```bash
git clone URL_DO_REPOSITORIO
cd OpticNoteBook
```

## Backend

### 2. Entre na pasta do backend

```bash
cd backend
```

### 3. Crie o ambiente virtual

```bash
python -m venv .venv
```

### 4. Ative o ambiente virtual

No Windows:

```powershell
.venv\Scripts\activate
```

### 5. Instale as dependências

```bash
pip install -r requirements.txt
```

### 6. Configure as variáveis de ambiente

Configure o arquivo de ambiente do backend com os dados necessários, principalmente:

* Banco de dados PostgreSQL
* Chave secreta do Django
* Configurações de CORS e CSRF
* Outras credenciais utilizadas pelo projeto

Use o arquivo `.env.example` como referência, caso esteja disponível.

### 7. Execute as migrations

```bash
python manage.py migrate
```

### 8. Inicie o backend

```bash
python manage.py runserver
```

Por padrão, o backend ficará disponível em:

```text
http://localhost:8000
```

## Frontend

### 9. Abra outro terminal e entre na pasta do frontend

```bash
cd frontend
```

### 10. Instale as dependências

```bash
npm install
```

### 11. Configure as variáveis de ambiente

Copie:

```text
.env.example
```

para:

```text
.env.local
```

Configure a URL do backend:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Caso utilize Cloudflare Turnstile:

```env
VITE_TURNSTILE_SITE_KEY=sua_chave_publica
```

### 12. Inicie o frontend

```bash
npm run dev
```

O endereço local normalmente será:

```text
http://localhost:5173
```

## Comandos úteis

### Backend

```bash
python manage.py runserver
python manage.py makemigrations
python manage.py migrate
```

### Frontend

```bash
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
npm audit
```

## Build do frontend

Para gerar a versão de produção:

```bash
npm run build
```

Os arquivos serão gerados na pasta:

```text
dist/
```
