-- Migração 002: assinatura por login (carimbo) e usuários motoristas
-- Rode UMA vez no banco que já existe (quem instalar do zero com o schema.sql novo não precisa).
SET NAMES utf8mb4;

ALTER TABLE usuarios
  MODIFY perfil ENUM('admin','vistoriador','motorista') NOT NULL DEFAULT 'vistoriador',
  ADD COLUMN matricula VARCHAR(40) NOT NULL DEFAULT '' AFTER login;

ALTER TABLE vistorias
  ADD COLUMN codigo_verificacao CHAR(64) NULL COMMENT 'SHA-256 do conteúdo e das assinaturas na conclusão' AFTER itens_nao;

-- Assinatura eletrônica por login e senha (vira o carimbo no relatório)
CREATE TABLE IF NOT EXISTS vistoria_assinaturas (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vistoria_id  INT UNSIGNED NOT NULL,
  papel        ENUM('motorista','vistoriador') NOT NULL,
  usuario_id   INT UNSIGNED NOT NULL,
  nome         VARCHAR(120) NOT NULL,
  matricula    VARCHAR(40)  NOT NULL DEFAULT '',
  perfil       VARCHAR(20)  NOT NULL,
  assinado_em  DATETIME     NOT NULL,
  ip           VARCHAR(45)  NOT NULL DEFAULT '',
  dispositivo  VARCHAR(255) NOT NULL DEFAULT '',
  UNIQUE KEY uk_assinatura (vistoria_id, papel),
  CONSTRAINT fk_ass_vist FOREIGN KEY (vistoria_id) REFERENCES vistorias(id) ON DELETE CASCADE,
  CONSTRAINT fk_ass_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- As colunas antigas assinatura_motorista e assinatura_vistoriador (desenho) não são mais usadas.
-- Elas podem ficar no banco sem problema.
