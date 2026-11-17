# ReviverFrota · Concessionária Reviver

Sistema de vistoria e controle de qualidade da frota, com:

- fichas por modelo de veículo (itens das fichas em papel "Controle de qualidade e checklist da frota" e "Ficha de controle de saída de frota");
- personalização por frota (esconder itens do modelo e incluir itens próprios);
- marcação de avarias no modelo 3D do veículo (12 visuais: hatch, sedã, SUV, picape, van, micro-ônibus, caminhão baú, caminhão com lona, moto, carrinhos elétricos de 2 e 4 lugares e utilitário elétrico), com foto;
- cabeçalho da ficha, combustível, guia de marcha, observações e assinaturas do motorista e do vistoriador;
- relatório de cada vistoria pronto para imprimir ou salvar em PDF;
- visual claro (padrão) e escuro.

## Identidade visual

Logo e ícones em `public/assets/img/`:

- `reviverfrota-logo.svg`: logo para fundo claro
- `reviverfrota-logo-negativo.svg`: logo para fundo escuro (azul-marinho)
- `reviverfrota-icone.svg` / `reviverfrota-icone-app.svg`: só o símbolo (com e sem fundo branco)
- `favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`: ícones da aba e da tela inicial do celular

## Requisitos

- PHP 8.1 ou mais novo, com as extensões `pdo_mysql` e `fileinfo`
- MySQL 8 ou MariaDB 10.4+
- Apache ou Nginx (ou o servidor embutido do PHP para testes)
- HTTPS em produção (a câmera do celular e o cookie de sessão seguro dependem disso)

## Estrutura

```
public/          ← única pasta que deve ficar acessível pela web (DocumentRoot)
  index.php        aplicação (vistoria, modelos, frotas)
  login.php / logout.php
  api.php          todas as ações do sistema (JSON)
  relatorio.php    ficha para impressão de uma vistoria
  assets/          app.js e app.css
src/             conexão, sessão e consultas
config/          config.php (você cria a partir do exemplo)
database/        schema.sql, seed.sql, exemplos.sql
storage/uploads/ fotos de avarias e assinaturas (fora da web)
bin/             criar_usuario.php
```

## Instalação

1. **Banco de dados**

   ```sql
   CREATE DATABASE checklist_frota CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'checklist'@'localhost' IDENTIFIED BY 'uma-senha-forte';
   GRANT SELECT, INSERT, UPDATE, DELETE ON checklist_frota.* TO 'checklist'@'localhost';
   ```

   Depois rode, nesta ordem:

   ```bash
   mysql -u root -p checklist_frota < database/schema.sql
   mysql -u root -p checklist_frota < database/seed.sql
   # só se o banco já existia antes da assinatura por carimbo:
   # mysql -u root -p checklist_frota < database/migracao_002_assinatura_carimbo.sql
   # opcional, só para testar com veículos de exemplo:
   mysql -u root -p checklist_frota < database/exemplos.sql
   ```

2. **Configuração**

   ```bash
   cp config/config.example.php config/config.php
   ```

   Ajuste os dados do banco em `config/config.php`.

3. **Pasta de uploads**: o usuário do servidor web precisa escrever em `storage/uploads`.

   ```bash
   chown -R www-data:www-data storage/uploads   # Linux/Apache
   ```

4. **Primeiro usuário (administrador)**

   ```bash
   php bin/criar_usuario.php --login=marcos --nome="Marcos Nascimento" --perfil=admin
   ```

   A senha é pedida no terminal (mínimo 8 caracteres). Para vistoriadores use `--perfil=vistoriador`.
   Para desativar alguém: `php bin/criar_usuario.php --login=fulano --desativar`.

5. **Servidor web**: aponte o DocumentRoot para a pasta `public/`.

   Para testar localmente:

   ```bash
   php -S 0.0.0.0:8080 -t public
   ```

   Se precisar colocar o projeto inteiro dentro do `htdocs` (XAMPP), o `.htaccess` da raiz redireciona para `public/` e bloqueia as outras pastas. Mesmo assim, o recomendado é usar `public/` como raiz.

## Perfis

| Perfil | Pode |
|---|---|
| Motorista | Não entra no sistema. Só assina a vistoria com o próprio usuário e senha, no aparelho do vistoriador |
| Vistoriador | Abrir e preencher vistorias, marcar avarias com foto, lançar guia de marcha, assinar e concluir, ver relatórios |
| Administrador | Tudo do vistoriador, mais modelos de checklist, frotas, itens próprios, veículos, visual 3D e usuários |

## Assinatura por carimbo

- Na conclusão, o motorista digita o usuário e a senha dele e o vistoriador confirma a própria senha. Cada assinatura vira um carimbo com nome, perfil, matrícula, data e hora.
- A mesma pessoa não pode assinar nos dois papéis.
- Se a vistoria for alterada depois de assinada (resposta, ficha ou avaria), as assinaturas são desfeitas e precisam ser feitas de novo.
- Ao concluir, o sistema grava um código de verificação (SHA-256 do conteúdo e das assinaturas). Os primeiros 12 caracteres aparecem no relatório.
- Usuários de motorista, vistoriador e administrador são cadastrados na tela **Usuários** (só administradores).

## Como os dados funcionam

- Cada veículo tem **uma vistoria aberta** por vez. Ela é criada sozinha quando alguém seleciona o veículo e fica salva enquanto é preenchida (cada resposta vai direto para o servidor).
- Ao **concluir**, o sistema grava uma cópia de todos os itens do checklist daquele momento, com as respostas. Se o modelo for editado depois, as vistorias antigas não mudam.
- Itens e seções removidos de um modelo são **desativados**, não apagados. Veículos removidos também, e a placa fica livre para um novo cadastro.
- As fotos são reduzidas no próprio celular (até 1600 px, JPEG) antes do envio, e o servidor confere o tipo do arquivo.
- Fotos e assinaturas ficam em `storage/uploads` e só são entregues para quem está logado (`api.php?action=foto`).

## Segurança

- Senhas com `password_hash`. Bloqueio de um minuto após 5 tentativas de login erradas na mesma sessão.
- Todas as ações que alteram dados exigem o token CSRF da sessão.
- Consultas com prepared statements.
- Cadastros (modelos, frotas, veículos) checados no servidor para o perfil administrador.

## Bibliotecas externas

- three.js r128 (modelo 3D), carregado do cdnjs. Para funcionar sem internet externa, baixe
  `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` para `public/assets/vendor/` e troque o `src` no fim do `index.php`.
- Fonte IBM Plex Sans do Google Fonts (se não carregar, o sistema usa a fonte do aparelho).

## Próximos passos sugeridos

- Tela de histórico com filtro por período, frota e placa.
- Exportar relatório de avarias por frota (planilha).
- Cadastro de usuários pela tela de administração (hoje é pelo terminal).
