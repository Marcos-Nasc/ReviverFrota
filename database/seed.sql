-- Carga inicial: modelos de checklist das fichas em papel da Concessionária Reviver
-- Rode uma única vez, depois do schema.sql
SET NAMES utf8mb4;
START TRANSACTION;

-- Carro de passeio
INSERT INTO modelos (nome, base3d, rotulo_sim, origem) VALUES ('Carro de passeio', 'carro', 'Sim', 'Ficha: Controle de qualidade e checklist da frota');
SET @m_carro = LAST_INSERT_ID();
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_carro, 'Elétrica e painel', 1); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Buzina', 'sn', '', 0, 1),
  (@s, 'Faróis', 'sn', '', 0, 2),
  (@s, 'Lanternas dianteiras', 'sn', '', 0, 3),
  (@s, 'Lanternas traseiras', 'sn', '', 0, 4),
  (@s, 'Pisca-pisca (luz alerta)', 'sn', '', 0, 5),
  (@s, 'Iluminação interna', 'sn', '', 0, 6),
  (@s, 'Instrumentos do painel', 'sn', '', 0, 7),
  (@s, 'Velocímetro', 'sn', '', 0, 8),
  (@s, 'Placas legíveis', 'sn', '', 0, 9),
  (@s, 'Limpador de para-brisa', 'sn', '', 0, 10),
  (@s, 'Numeração e marca da bateria', 'texto', '', 0, 11);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_carro, 'Mecânica', 2); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Embreagem', 'sn', '', 0, 1),
  (@s, 'Transmissão', 'sn', '', 0, 2),
  (@s, 'Suspensão', 'sn', '', 0, 3),
  (@s, 'Freios', 'sn', '', 0, 4),
  (@s, 'Freio de mão', 'sn', '', 0, 5),
  (@s, 'Caixa de direção', 'sn', '', 0, 6),
  (@s, 'Caixa de marcha', 'sn', '', 0, 7);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_carro, 'Fluidos', 3); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Nível de água do radiador', 'sn', '', 0, 1),
  (@s, 'Nível de óleo do motor', 'sn', '', 0, 2),
  (@s, 'Óleo do sistema hidráulico', 'sn', '', 0, 3);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_carro, 'Lataria e externo', 4); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Lataria (especificar obs.)', 'sn', '', 1, 1),
  (@s, 'Maçanetas interna/externa', 'sn', '', 0, 2),
  (@s, 'Vidro das portas', 'sn', '', 0, 3),
  (@s, 'Pneus', 'sn', '', 0, 4),
  (@s, 'Limpeza externa', 'sn', '', 0, 5);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_carro, 'Interior', 5); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Tapetes', 'sn', '', 0, 1),
  (@s, 'Cintos de segurança', 'sn', '', 0, 2),
  (@s, 'Estofamento', 'sn', '', 0, 3),
  (@s, 'Volante da direção', 'sn', '', 0, 4),
  (@s, 'Ar-condicionado', 'sn', '', 0, 5),
  (@s, 'Tampa do porta-luvas', 'sn', '', 0, 6),
  (@s, 'Limpeza interna', 'sn', '', 0, 7),
  (@s, 'Limpeza do porta-malas', 'sn', '', 0, 8);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_carro, 'Segurança e documentos', 6); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Documentação', 'sn', '', 0, 1),
  (@s, 'Extintor de incêndio', 'sn', '', 0, 2),
  (@s, 'Triângulo', 'sn', '', 0, 3),
  (@s, 'Macaco', 'sn', '', 0, 4),
  (@s, 'Estepe', 'sn', '', 0, 5),
  (@s, 'Carrinho de corpo', 'sn', '', 0, 6);

-- SUV e picape
INSERT INTO modelos (nome, base3d, rotulo_sim, origem) VALUES ('SUV e picape', 'suv', 'Sim', 'Ficha: Controle de qualidade e checklist da frota');
SET @m_suv = LAST_INSERT_ID();
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_suv, 'Elétrica e painel', 1); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Buzina', 'sn', '', 0, 1),
  (@s, 'Faróis', 'sn', '', 0, 2),
  (@s, 'Lanternas dianteiras', 'sn', '', 0, 3),
  (@s, 'Lanternas traseiras', 'sn', '', 0, 4),
  (@s, 'Pisca-pisca (luz alerta)', 'sn', '', 0, 5),
  (@s, 'Iluminação interna', 'sn', '', 0, 6),
  (@s, 'Instrumentos do painel', 'sn', '', 0, 7),
  (@s, 'Velocímetro', 'sn', '', 0, 8),
  (@s, 'Placas legíveis', 'sn', '', 0, 9),
  (@s, 'Limpador de para-brisa', 'sn', '', 0, 10),
  (@s, 'Numeração e marca da bateria', 'texto', '', 0, 11);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_suv, 'Mecânica', 2); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Embreagem', 'sn', '', 0, 1),
  (@s, 'Transmissão', 'sn', '', 0, 2),
  (@s, 'Suspensão', 'sn', '', 0, 3),
  (@s, 'Freios', 'sn', '', 0, 4),
  (@s, 'Freio de mão', 'sn', '', 0, 5),
  (@s, 'Caixa de direção', 'sn', '', 0, 6),
  (@s, 'Caixa de marcha', 'sn', '', 0, 7);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_suv, 'Fluidos', 3); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Nível de água do radiador', 'sn', '', 0, 1),
  (@s, 'Nível de óleo do motor', 'sn', '', 0, 2),
  (@s, 'Óleo do sistema hidráulico', 'sn', '', 0, 3);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_suv, 'Lataria e externo', 4); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Lataria (especificar obs.)', 'sn', '', 1, 1),
  (@s, 'Maçanetas interna/externa', 'sn', '', 0, 2),
  (@s, 'Vidro das portas', 'sn', '', 0, 3),
  (@s, 'Pneus', 'sn', '', 0, 4),
  (@s, 'Limpeza externa', 'sn', '', 0, 5);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_suv, 'Interior', 5); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Tapetes', 'sn', '', 0, 1),
  (@s, 'Cintos de segurança', 'sn', '', 0, 2),
  (@s, 'Estofamento', 'sn', '', 0, 3),
  (@s, 'Volante da direção', 'sn', '', 0, 4),
  (@s, 'Ar-condicionado', 'sn', '', 0, 5),
  (@s, 'Tampa do porta-luvas', 'sn', '', 0, 6),
  (@s, 'Limpeza interna', 'sn', '', 0, 7),
  (@s, 'Limpeza do porta-malas', 'sn', '', 0, 8);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_suv, 'Segurança e documentos', 6); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Documentação', 'sn', '', 0, 1),
  (@s, 'Extintor de incêndio', 'sn', '', 0, 2),
  (@s, 'Triângulo', 'sn', '', 0, 3),
  (@s, 'Macaco', 'sn', '', 0, 4),
  (@s, 'Estepe', 'sn', '', 0, 5),
  (@s, 'Carrinho de corpo', 'sn', '', 0, 6);

-- Caminhão e ônibus
INSERT INTO modelos (nome, base3d, rotulo_sim, origem) VALUES ('Caminhão e ônibus', 'caminhao', 'OK', 'Ficha: Controle de saída de frota');
SET @m_caminhao = LAST_INSERT_ID();
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_caminhao, 'Cabine e painel', 1); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Buzina funcionando', 'sn', '', 0, 1),
  (@s, 'Lâmpadas (lançar na obs.)', 'sn', '', 1, 2),
  (@s, 'Cintos de segurança', 'sn', '', 0, 3),
  (@s, 'Interior da cabine limpo', 'sn', '', 0, 4),
  (@s, 'Instrumentos do painel', 'sn', '', 0, 5),
  (@s, 'Tampa do porta-luvas', 'sn', '', 0, 6);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_caminhao, 'Documentos e placas', 2); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Placas legíveis', 'sn', '', 0, 1),
  (@s, 'Documento do veículo', 'sn', '', 0, 2);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_caminhao, 'Freios', 3); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Freio', 'sn', '', 0, 1),
  (@s, 'Freio de mão', 'sn', '', 0, 2);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_caminhao, 'Externo', 4); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Espelhos retrovisores', 'sn', '', 0, 1),
  (@s, 'Maçanetas interna/externa', 'sn', '', 0, 2),
  (@s, 'Pneus (lançar na obs.)', 'sn', '', 1, 3),
  (@s, 'Vidros (lançar na obs.)', 'sn', '', 1, 4);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_caminhao, 'Fluidos', 5); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Nível de água do radiador', 'sn', '', 0, 1),
  (@s, 'Nível de óleo do motor', 'sn', '', 0, 2),
  (@s, 'Óleo do sistema hidráulico', 'sn', '', 0, 3);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_caminhao, 'Segurança', 6); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Macaco', 'sn', '', 0, 1),
  (@s, 'Estepe', 'sn', '', 0, 2),
  (@s, 'Triângulo', 'sn', '', 0, 3),
  (@s, 'Extintor de incêndio', 'sn', '', 0, 4);

-- Carrinho elétrico
INSERT INTO modelos (nome, base3d, rotulo_sim, origem) VALUES ('Carrinho elétrico', 'golfe', 'OK', 'Sugestão: não há ficha em papel');
SET @m_golfe = LAST_INSERT_ID();
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_golfe, 'Bateria', 1); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Carga da bateria', 'num', '%', 0, 1),
  (@s, 'Cabos e conectores sem oxidação', 'sn', '', 0, 2),
  (@s, 'Carregador e plugue', 'sn', '', 0, 3);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_golfe, 'Funcionamento', 2); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Buzina', 'sn', '', 0, 1),
  (@s, 'Faróis e lanternas', 'sn', '', 0, 2),
  (@s, 'Freio', 'sn', '', 0, 3),
  (@s, 'Freio de estacionamento', 'sn', '', 0, 4),
  (@s, 'Alarme de ré', 'sn', '', 0, 5),
  (@s, 'Volante da direção', 'sn', '', 0, 6);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_golfe, 'Estrutura', 3); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Capota', 'sn', '', 0, 1),
  (@s, 'Para-brisa', 'sn', '', 0, 2),
  (@s, 'Carenagem', 'sn', '', 0, 3),
  (@s, 'Bancos e estofamento', 'sn', '', 0, 4),
  (@s, 'Pneus', 'sn', '', 0, 5);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_golfe, 'Limpeza', 4); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Limpeza externa', 'sn', '', 0, 1),
  (@s, 'Limpeza interna', 'sn', '', 0, 2);

-- Motocicleta
INSERT INTO modelos (nome, base3d, rotulo_sim, origem) VALUES ('Motocicleta', 'moto', 'OK', 'Sugestão: não há ficha em papel');
SET @m_moto = LAST_INSERT_ID();
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_moto, 'Elétrica', 1); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Buzina', 'sn', '', 0, 1),
  (@s, 'Farol', 'sn', '', 0, 2),
  (@s, 'Lanterna e luz de freio', 'sn', '', 0, 3),
  (@s, 'Setas', 'sn', '', 0, 4),
  (@s, 'Painel e velocímetro', 'sn', '', 0, 5),
  (@s, 'Placa legível', 'sn', '', 0, 6);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_moto, 'Mecânica', 2); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Freio dianteiro', 'sn', '', 0, 1),
  (@s, 'Freio traseiro', 'sn', '', 0, 2),
  (@s, 'Corrente e relação', 'sn', '', 0, 3),
  (@s, 'Embreagem', 'sn', '', 0, 4),
  (@s, 'Nível de óleo do motor', 'sn', '', 0, 5);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_moto, 'Pneus', 3); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Pneu dianteiro', 'sn', '', 0, 1),
  (@s, 'Pneu traseiro', 'sn', '', 0, 2);
INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (@m_moto, 'Segurança e documentos', 4); SET @s = LAST_INSERT_ID();
INSERT INTO modelo_itens (secao_id, texto, tipo, unidade, pede_obs, ordem) VALUES
  (@s, 'Documentação', 'sn', '', 0, 1),
  (@s, 'Retrovisores', 'sn', '', 0, 2),
  (@s, 'Capacete', 'sn', '', 0, 3),
  (@s, 'Antena corta-pipa', 'sn', '', 0, 4);

-- Frotas
INSERT INTO frotas (nome, setor) VALUES ('Frota leve','Operação'); SET @f_leve = LAST_INSERT_ID();
INSERT INTO frotas (nome, setor) VALUES ('Frota pesada','Manutenção'); SET @f_pesada = LAST_INSERT_ID();
INSERT INTO frotas (nome, setor) VALUES ('Pátio','Pátio e estacionamento'); SET @f_patio = LAST_INSERT_ID();

-- Itens próprios das frotas
INSERT INTO frota_itens_extras (frota_id, modelo_id, secao, texto, tipo, unidade) VALUES
  (@f_leve, NULL, 'Lataria e externo', 'Adesivos de identificação Reviver', 'sn', ''),
  (@f_pesada, @m_caminhao, 'Documentos e placas', 'Tacógrafo aferido', 'sn', ''),
  (@f_pesada, @m_caminhao, 'Externo', 'Lona / carroceria sem rasgos', 'sn', ''),
  (@f_patio, NULL, 'Funcionamento', 'Giroflex funcionando', 'sn', ''),
  (@f_patio, @m_golfe, 'Bateria', 'Horímetro', 'num', 'h');

COMMIT;
