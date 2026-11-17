-- Veículos de EXEMPLO para teste (opcional). Não rode em produção.
SET NAMES utf8mb4;
START TRANSACTION;
INSERT INTO veiculos (placa, descricao, modelo_id, frota_id, base3d, cor)
SELECT 'RIO4E21', 'Onix', (SELECT id FROM modelos WHERE nome='Carro de passeio' LIMIT 1), (SELECT id FROM frotas WHERE nome='Frota leve' LIMIT 1), 'hatch', 15659250
UNION ALL
SELECT 'QTR5C88', 'Virtus', (SELECT id FROM modelos WHERE nome='Carro de passeio' LIMIT 1), (SELECT id FROM frotas WHERE nome='Frota leve' LIMIT 1), 'carro', 12173511
UNION ALL
SELECT 'KXP7B03', 'Jeep Compass', (SELECT id FROM modelos WHERE nome='SUV e picape' LIMIT 1), (SELECT id FROM frotas WHERE nome='Frota leve' LIMIT 1), 'suv', 2969468
UNION ALL
SELECT 'LMN8D45', 'Hilux cabine dupla', (SELECT id FROM modelos WHERE nome='SUV e picape' LIMIT 1), (SELECT id FROM frotas WHERE nome='Frota leve' LIMIT 1), 'picape', 4870232
UNION ALL
SELECT 'RJX3F12', 'Master furgão', (SELECT id FROM modelos WHERE nome='Carro de passeio' LIMIT 1), (SELECT id FROM frotas WHERE nome='Frota leve' LIMIT 1), 'van', 15659250
UNION ALL
SELECT 'MTO2G55', 'CG 160 Fan', (SELECT id FROM modelos WHERE nome='Motocicleta' LIMIT 1), (SELECT id FROM frotas WHERE nome='Frota leve' LIMIT 1), 'moto', 10365483
UNION ALL
SELECT 'LTQ2A90', 'Accelo 1016 baú', (SELECT id FROM modelos WHERE nome='Caminhão e ônibus' LIMIT 1), (SELECT id FROM frotas WHERE nome='Frota pesada' LIMIT 1), 'caminhao', 15659250
UNION ALL
SELECT 'KRV6H30', 'Atego carroceria', (SELECT id FROM modelos WHERE nome='Caminhão e ônibus' LIMIT 1), (SELECT id FROM frotas WHERE nome='Frota pesada' LIMIT 1), 'caminhao_lona', 2969468
UNION ALL
SELECT 'BUS1J07', 'Volare micro-ônibus', (SELECT id FROM modelos WHERE nome='Caminhão e ônibus' LIMIT 1), (SELECT id FROM frotas WHERE nome='Frota pesada' LIMIT 1), 'onibus', 15659250
UNION ALL
SELECT 'GOLF-03', 'Carrinho 4 lugares', (SELECT id FROM modelos WHERE nome='Carrinho elétrico' LIMIT 1), (SELECT id FROM frotas WHERE nome='Pátio' LIMIT 1), 'golfe', 15659250
UNION ALL
SELECT 'GOLF-07', 'Carrinho 2 lugares', (SELECT id FROM modelos WHERE nome='Carrinho elétrico' LIMIT 1), (SELECT id FROM frotas WHERE nome='Pátio' LIMIT 1), 'golfe2', 4025167
UNION ALL
SELECT 'UTIL-02', 'Utilitário com caçamba', (SELECT id FROM modelos WHERE nome='Carrinho elétrico' LIMIT 1), (SELECT id FROM frotas WHERE nome='Pátio' LIMIT 1), 'utilitario', 15659250;

COMMIT;
