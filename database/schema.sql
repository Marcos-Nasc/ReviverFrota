-- Checklist de Frota · Concessionária Reviver
-- Estrutura do banco (MySQL 8 / MariaDB 10.4+)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS usuarios (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome          VARCHAR(120) NOT NULL,
  login         VARCHAR(60)  NOT NULL UNIQUE,
  matricula     VARCHAR(40)  NOT NULL DEFAULT '',
  senha_hash    VARCHAR(255) NOT NULL,
  perfil        ENUM('admin','vistoriador','motorista') NOT NULL DEFAULT 'vistoriador',
  ativo         TINYINT(1) NOT NULL DEFAULT 1,
  ultimo_acesso DATETIME NULL,
  criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Modelo de checklist (ex.: Carro de passeio, Caminhão e ônibus)
CREATE TABLE IF NOT EXISTS modelos (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(100) NOT NULL,
  base3d      VARCHAR(30)  NOT NULL DEFAULT 'carro',
  rotulo_sim  VARCHAR(10)  NOT NULL DEFAULT 'Sim',
  origem      VARCHAR(150) NOT NULL DEFAULT '',
  ativo       TINYINT(1)   NOT NULL DEFAULT 1,
  criado_em   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS modelo_secoes (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  modelo_id  INT UNSIGNED NOT NULL,
  nome       VARCHAR(100) NOT NULL,
  ordem      SMALLINT     NOT NULL DEFAULT 0,
  ativo      TINYINT(1)   NOT NULL DEFAULT 1,
  CONSTRAINT fk_secao_modelo FOREIGN KEY (modelo_id) REFERENCES modelos(id),
  INDEX idx_secao_modelo (modelo_id, ativo, ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- tipo: sn = Sim/Não (ou OK/Não), num = número, texto = texto livre
CREATE TABLE IF NOT EXISTS modelo_itens (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  secao_id   INT UNSIGNED NOT NULL,
  texto      VARCHAR(200) NOT NULL,
  tipo       ENUM('sn','num','texto') NOT NULL DEFAULT 'sn',
  unidade    VARCHAR(12)  NOT NULL DEFAULT '',
  pede_obs   TINYINT(1)   NOT NULL DEFAULT 0,
  ordem      SMALLINT     NOT NULL DEFAULT 0,
  ativo      TINYINT(1)   NOT NULL DEFAULT 1,
  CONSTRAINT fk_item_secao FOREIGN KEY (secao_id) REFERENCES modelo_secoes(id),
  INDEX idx_item_secao (secao_id, ativo, ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS frotas (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome       VARCHAR(100) NOT NULL,
  setor      VARCHAR(100) NOT NULL DEFAULT '',
  ativo      TINYINT(1)   NOT NULL DEFAULT 1,
  criado_em  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Itens próprios de uma frota. modelo_id NULL = vale para todos os modelos
CREATE TABLE IF NOT EXISTS frota_itens_extras (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  frota_id   INT UNSIGNED NOT NULL,
  modelo_id  INT UNSIGNED NULL,
  secao      VARCHAR(100) NOT NULL,
  texto      VARCHAR(200) NOT NULL,
  tipo       ENUM('sn','num','texto') NOT NULL DEFAULT 'sn',
  unidade    VARCHAR(12)  NOT NULL DEFAULT '',
  ativo      TINYINT(1)   NOT NULL DEFAULT 1,
  CONSTRAINT fk_extra_frota  FOREIGN KEY (frota_id)  REFERENCES frotas(id),
  CONSTRAINT fk_extra_modelo FOREIGN KEY (modelo_id) REFERENCES modelos(id),
  INDEX idx_extra_frota (frota_id, ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Itens do modelo que uma frota não usa
CREATE TABLE IF NOT EXISTS frota_itens_ocultos (
  frota_id  INT UNSIGNED NOT NULL,
  item_id   INT UNSIGNED NOT NULL,
  PRIMARY KEY (frota_id, item_id),
  CONSTRAINT fk_oculto_frota FOREIGN KEY (frota_id) REFERENCES frotas(id),
  CONSTRAINT fk_oculto_item  FOREIGN KEY (item_id)  REFERENCES modelo_itens(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- base3d: visual 3D do veículo (NULL = usa o do modelo). cor: RGB em inteiro (ex.: 0xEEF0F2)
CREATE TABLE IF NOT EXISTS veiculos (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  placa      VARCHAR(20)  NOT NULL UNIQUE,
  descricao  VARCHAR(120) NOT NULL,
  modelo_id  INT UNSIGNED NOT NULL,
  frota_id   INT UNSIGNED NOT NULL,
  base3d     VARCHAR(30)  NULL,
  cor        INT UNSIGNED NULL,
  ativo      TINYINT(1)   NOT NULL DEFAULT 1,
  criado_em  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_veiculo_modelo FOREIGN KEY (modelo_id) REFERENCES modelos(id),
  CONSTRAINT fk_veiculo_frota  FOREIGN KEY (frota_id)  REFERENCES frotas(id),
  INDEX idx_veiculo_frota (frota_id, ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vistorias (
  id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  veiculo_id              INT UNSIGNED NOT NULL,
  modelo_id               INT UNSIGNED NOT NULL,
  base3d                  VARCHAR(30)  NOT NULL,
  status                  ENUM('aberta','concluida') NOT NULL DEFAULT 'aberta',
  data                    DATE         NOT NULL,
  setor                   VARCHAR(100) NOT NULL DEFAULT '',
  km                      INT UNSIGNED NULL,
  motorista               VARCHAR(120) NOT NULL DEFAULT '',
  matricula               VARCHAR(40)  NOT NULL DEFAULT '',
  combustivel             TINYINT      NULL COMMENT '0=E 1=1/4 2=1/2 3=3/4 4=F',
  obs                     TEXT         NULL,
  total_itens             SMALLINT     NOT NULL DEFAULT 0,
  itens_respondidos       SMALLINT     NOT NULL DEFAULT 0,
  itens_nao               SMALLINT     NOT NULL DEFAULT 0,
  codigo_verificacao      CHAR(64)     NULL COMMENT 'SHA-256 do conteúdo e das assinaturas na conclusão',
  aberta_por              INT UNSIGNED NOT NULL,
  concluida_por           INT UNSIGNED NULL,
  iniciada_em             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  concluida_em            DATETIME     NULL,
  CONSTRAINT fk_vist_veiculo FOREIGN KEY (veiculo_id) REFERENCES veiculos(id),
  CONSTRAINT fk_vist_aberta  FOREIGN KEY (aberta_por) REFERENCES usuarios(id),
  INDEX idx_vist_veiculo (veiculo_id, status),
  INDEX idx_vist_data (data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Respostas guardam cópia do texto e da seção para o histórico não mudar se o modelo for editado
CREATE TABLE IF NOT EXISTS vistoria_respostas (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vistoria_id  INT UNSIGNED NOT NULL,
  origem       ENUM('modelo','frota') NOT NULL,
  item_id      INT UNSIGNED NOT NULL,
  secao        VARCHAR(100) NOT NULL,
  item_texto   VARCHAR(200) NOT NULL,
  tipo         ENUM('sn','num','texto') NOT NULL DEFAULT 'sn',
  unidade      VARCHAR(12)  NOT NULL DEFAULT '',
  valor        VARCHAR(255) NULL,
  obs          VARCHAR(255) NULL,
  ordem        SMALLINT     NOT NULL DEFAULT 0,
  atualizado_em DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_resp (vistoria_id, origem, item_id),
  CONSTRAINT fk_resp_vist FOREIGN KEY (vistoria_id) REFERENCES vistorias(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS avarias (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vistoria_id  INT UNSIGNED NOT NULL,
  peca_chave   VARCHAR(40)  NOT NULL,
  lado         ENUM('e','d') NULL,
  parte        VARCHAR(120) NOT NULL,
  tipo         VARCHAR(30)  NOT NULL,
  gravidade    ENUM('leve','media','grave') NOT NULL,
  obs          TEXT         NULL,
  foto         VARCHAR(255) NULL,
  pos_x        DECIMAL(9,4) NULL,
  pos_y        DECIMAL(9,4) NULL,
  pos_z        DECIMAL(9,4) NULL,
  criado_por   INT UNSIGNED NOT NULL,
  criado_em    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_av_vist FOREIGN KEY (vistoria_id) REFERENCES vistorias(id) ON DELETE CASCADE,
  INDEX idx_av_vist (vistoria_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guia_marcha (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  veiculo_id    INT UNSIGNED NOT NULL,
  data          DATE         NOT NULL,
  hora          TIME         NULL,
  motorista     VARCHAR(120) NOT NULL,
  destino       VARCHAR(200) NOT NULL,
  km_inicial    INT UNSIGNED NULL,
  km_final      INT UNSIGNED NULL,
  hora_chegada  TIME         NULL,
  criado_por    INT UNSIGNED NOT NULL,
  criado_em     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_guia_veiculo FOREIGN KEY (veiculo_id) REFERENCES veiculos(id),
  INDEX idx_guia_veiculo (veiculo_id, data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
