<?php
declare(strict_types=1);

// Consultas de leitura usadas pela API e pelo relatório.
// IDs vão para o front como texto com prefixo: m12 = item de modelo, x3 = item extra da frota, s5 = seção.

const BASES_3D = ['hatch', 'carro', 'suv', 'picape', 'van', 'onibus', 'caminhao', 'caminhao_lona', 'moto', 'golfe', 'golfe2', 'utilitario'];

function carregarModelos(?int $soId = null): array
{
    $pdo = db();
    $sql = 'SELECT id, nome, base3d, rotulo_sim, origem FROM modelos WHERE ativo = 1' . ($soId ? ' AND id = ?' : '') . ' ORDER BY id';
    $st = $pdo->prepare($sql);
    $st->execute($soId ? [$soId] : []);
    $modelos = [];
    foreach ($st as $m) {
        $modelos[(int)$m['id']] = [
            'id'     => (string)$m['id'],
            'nome'   => $m['nome'],
            'base'   => $m['base3d'],
            'rot'    => [$m['rotulo_sim'], 'Não'],
            'origem' => $m['origem'],
            'secoes' => [],
        ];
    }
    if (!$modelos) {
        return [];
    }
    $ids = implode(',', array_keys($modelos));
    $secoes = [];
    foreach ($pdo->query("SELECT id, modelo_id, nome FROM modelo_secoes WHERE ativo = 1 AND modelo_id IN ($ids) ORDER BY ordem, id") as $s) {
        $secoes[(int)$s['id']] = ['mid' => (int)$s['modelo_id'], 'd' => ['id' => 's' . $s['id'], 'nome' => $s['nome'], 'itens' => []]];
    }
    if ($secoes) {
        $sids = implode(',', array_keys($secoes));
        foreach ($pdo->query("SELECT id, secao_id, texto, tipo, unidade, pede_obs FROM modelo_itens WHERE ativo = 1 AND secao_id IN ($sids) ORDER BY ordem, id") as $i) {
            $secoes[(int)$i['secao_id']]['d']['itens'][] = [
                'id'    => 'm' . $i['id'],
                'texto' => $i['texto'],
                'tipo'  => $i['tipo'],
                'un'    => $i['unidade'],
                'obs'   => (bool)$i['pede_obs'],
            ];
        }
    }
    foreach ($secoes as $s) {
        $modelos[$s['mid']]['secoes'][] = $s['d'];
    }
    return array_values($modelos);
}

function carregarFrotas(): array
{
    $pdo = db();
    $frotas = [];
    foreach ($pdo->query('SELECT id, nome, setor FROM frotas WHERE ativo = 1 ORDER BY nome') as $f) {
        $frotas[(int)$f['id']] = ['id' => (string)$f['id'], 'nome' => $f['nome'], 'setor' => $f['setor'], 'extras' => [], 'ocultos' => []];
    }
    foreach ($pdo->query('SELECT id, frota_id, modelo_id, secao, texto, tipo, unidade FROM frota_itens_extras WHERE ativo = 1 ORDER BY id') as $x) {
        if (!isset($frotas[(int)$x['frota_id']])) {
            continue;
        }
        $frotas[(int)$x['frota_id']]['extras'][] = [
            'id'      => 'x' . $x['id'],
            'secao'   => $x['secao'],
            'texto'   => $x['texto'],
            'tipo'    => $x['tipo'],
            'un'      => $x['unidade'],
            'modelos' => $x['modelo_id'] ? [(string)$x['modelo_id']] : [],
        ];
    }
    foreach ($pdo->query('SELECT frota_id, item_id FROM frota_itens_ocultos') as $o) {
        if (isset($frotas[(int)$o['frota_id']])) {
            $frotas[(int)$o['frota_id']]['ocultos'][] = 'm' . $o['item_id'];
        }
    }
    return array_values($frotas);
}

function carregarVeiculos(): array
{
    $out = [];
    foreach (db()->query('SELECT id, placa, descricao, modelo_id, frota_id, base3d, cor FROM veiculos WHERE ativo = 1 ORDER BY placa') as $v) {
        $out[] = [
            'id'       => (string)$v['id'],
            'placa'    => $v['placa'],
            'desc'     => $v['descricao'],
            'modeloId' => (string)$v['modelo_id'],
            'frotaId'  => (string)$v['frota_id'],
            'base'     => $v['base3d'],
            'cor'      => $v['cor'] === null ? null : (int)$v['cor'],
        ];
    }
    return $out;
}

function buscarVeiculo(int $id): ?array
{
    $st = db()->prepare('SELECT * FROM veiculos WHERE id = ? AND ativo = 1');
    $st->execute([$id]);
    return $st->fetch() ?: null;
}

/**
 * Lista ordenada dos itens que valem para o veículo: itens do modelo (menos os ocultos da frota)
 * mais os itens extras da frota. Mesma regra do front.
 */
function checklistDoVeiculo(array $veiculo): array
{
    $pdo = db();
    $st = $pdo->prepare(
        'SELECT i.id, i.texto, i.tipo, i.unidade, s.nome AS secao
           FROM modelo_itens i
           JOIN modelo_secoes s ON s.id = i.secao_id AND s.ativo = 1
          WHERE s.modelo_id = ? AND i.ativo = 1
            AND i.id NOT IN (SELECT item_id FROM frota_itens_ocultos WHERE frota_id = ?)
          ORDER BY s.ordem, s.id, i.ordem, i.id'
    );
    $st->execute([$veiculo['modelo_id'], $veiculo['frota_id']]);
    $itens = [];
    $ordemSecao = [];
    foreach ($st as $r) {
        $ordemSecao[$r['secao']] ??= count($ordemSecao);
        $itens[] = ['origem' => 'modelo', 'id' => (int)$r['id'], 'secao' => $r['secao'], 'texto' => $r['texto'], 'tipo' => $r['tipo'], 'unidade' => $r['unidade']];
    }
    $st = $pdo->prepare('SELECT id, secao, texto, tipo, unidade FROM frota_itens_extras WHERE frota_id = ? AND ativo = 1 AND (modelo_id IS NULL OR modelo_id = ?) ORDER BY id');
    $st->execute([$veiculo['frota_id'], $veiculo['modelo_id']]);
    foreach ($st as $r) {
        $ordemSecao[$r['secao']] ??= count($ordemSecao);
        $itens[] = ['origem' => 'frota', 'id' => (int)$r['id'], 'secao' => $r['secao'], 'texto' => $r['texto'], 'tipo' => $r['tipo'], 'unidade' => $r['unidade']];
    }
    // agrupa por seção mantendo a ordem de aparição (extras entram na seção de mesmo nome)
    usort($itens, fn($a, $b) => $ordemSecao[$a['secao']] <=> $ordemSecao[$b['secao']]);
    return $itens;
}

function urlFotoAvaria(array $a): ?string
{
    return $a['foto'] ? 'api.php?action=foto&id=' . $a['id'] . '&v=' . substr(md5($a['foto']), 0, 8) : null;
}

/** Vistoria aberta do veículo; cria uma nova se não houver. */
function vistoriaAberta(array $veiculo, int $usuarioId): int
{
    $pdo = db();
    $st = $pdo->prepare("SELECT id FROM vistorias WHERE veiculo_id = ? AND status = 'aberta' ORDER BY id DESC LIMIT 1");
    $st->execute([$veiculo['id']]);
    $id = $st->fetchColumn();
    if ($id) {
        return (int)$id;
    }
    $st = $pdo->prepare('SELECT setor FROM frotas WHERE id = ?');
    $st->execute([$veiculo['frota_id']]);
    $setor = (string)$st->fetchColumn();
    $st = $pdo->prepare("SELECT km FROM vistorias WHERE veiculo_id = ? AND status = 'concluida' ORDER BY concluida_em DESC LIMIT 1");
    $st->execute([$veiculo['id']]);
    $km = $st->fetchColumn();
    $modelo = db()->prepare('SELECT base3d FROM modelos WHERE id = ?');
    $modelo->execute([$veiculo['modelo_id']]);
    $base = $veiculo['base3d'] ?: ($modelo->fetchColumn() ?: 'carro');
    $st = $pdo->prepare('INSERT INTO vistorias (veiculo_id, modelo_id, base3d, data, setor, km, aberta_por) VALUES (?, ?, ?, CURDATE(), ?, ?, ?)');
    $st->execute([$veiculo['id'], $veiculo['modelo_id'], $base, $setor, $km === false ? null : $km, $usuarioId]);
    return (int)$pdo->lastInsertId();
}

/** Dados da vistoria no formato que o front usa. */
function dadosVistoria(int $vistoriaId): array
{
    $pdo = db();
    $st = $pdo->prepare('SELECT * FROM vistorias WHERE id = ?');
    $st->execute([$vistoriaId]);
    $v = $st->fetch();
    if (!$v) {
        throw new RuntimeException('Vistoria não encontrada.');
    }
    $resp = [];
    $robs = [];
    $st = $pdo->prepare('SELECT origem, item_id, valor, obs FROM vistoria_respostas WHERE vistoria_id = ?');
    $st->execute([$vistoriaId]);
    foreach ($st as $r) {
        $ref = ($r['origem'] === 'frota' ? 'x' : 'm') . $r['item_id'];
        if ($r['valor'] !== null && $r['valor'] !== '') {
            $resp[$ref] = $r['valor'];
        }
        if ($r['obs'] !== null && $r['obs'] !== '') {
            $robs[$ref] = $r['obs'];
        }
    }
    $avarias = [];
    $st = $pdo->prepare('SELECT * FROM avarias WHERE vistoria_id = ? ORDER BY id');
    $st->execute([$vistoriaId]);
    foreach ($st as $a) {
        $avarias[] = formatarAvaria($a);
    }
    $st = $pdo->prepare('SELECT * FROM guia_marcha WHERE veiculo_id = ? ORDER BY data DESC, id DESC LIMIT 30');
    $st->execute([$v['veiculo_id']]);
    $guia = array_map(fn($g) => [
        'id' => (string)$g['id'], 'data' => $g['data'], 'hora' => $g['hora'] ? substr($g['hora'], 0, 5) : '',
        'motorista' => $g['motorista'], 'destino' => $g['destino'],
        'kmIni' => $g['km_inicial'] === null ? '' : (string)$g['km_inicial'],
        'kmFim' => $g['km_final'] === null ? '' : (string)$g['km_final'],
        'horaF' => $g['hora_chegada'] ? substr($g['hora_chegada'], 0, 5) : '',
    ], $st->fetchAll());
    $st = $pdo->prepare(
        "SELECT v.id, v.concluida_em, v.itens_nao, v.motorista, (SELECT COUNT(*) FROM avarias a WHERE a.vistoria_id = v.id) AS av
           FROM vistorias v WHERE v.veiculo_id = ? AND v.status = 'concluida' ORDER BY v.concluida_em DESC LIMIT 5"
    );
    $st->execute([$v['veiculo_id']]);
    $anteriores = array_map(fn($h) => [
        'id' => (string)$h['id'], 'fim' => $h['concluida_em'], 'nok' => (int)$h['itens_nao'], 'av' => (int)$h['av'], 'motorista' => $h['motorista'],
    ], $st->fetchAll());

    return [
        'id'     => (string)$v['id'],
        'status' => $v['status'],
        'assinaturas' => (object)carregarAssinaturas($vistoriaId),
        'ficha'  => [
            'data' => $v['data'], 'setor' => $v['setor'], 'km' => $v['km'] === null ? '' : (string)$v['km'],
            'motorista' => $v['motorista'], 'matricula' => $v['matricula'],
            'comb' => $v['combustivel'] === null ? null : (int)$v['combustivel'], 'obs' => (string)$v['obs'],
        ],
        'resp'       => (object)$resp,
        'robs'       => (object)$robs,
        'avarias'    => $avarias,
        'guia'       => $guia,
        'anteriores' => $anteriores,
    ];
}

function formatarAvaria(array $a): array
{
    return [
        'id'    => (string)$a['id'],
        'key'   => $a['peca_chave'],
        'lado'  => $a['lado'],
        'parte' => $a['parte'],
        'tipo'  => $a['tipo'],
        'grav'  => $a['gravidade'],
        'obs'   => (string)$a['obs'],
        'foto'  => urlFotoAvaria($a),
        'pos'   => $a['pos_x'] === null ? null : [(float)$a['pos_x'], (float)$a['pos_y'], (float)$a['pos_z']],
        'data'  => $a['criado_em'],
    ];
}

/* ---------- assinaturas (carimbo) ---------- */

/** Assinaturas da vistoria, indexadas pelo papel (motorista / vistoriador). */
function carregarAssinaturas(int $vistoriaId): array
{
    $st = db()->prepare('SELECT papel, usuario_id, nome, matricula, perfil, assinado_em FROM vistoria_assinaturas WHERE vistoria_id = ?');
    $st->execute([$vistoriaId]);
    $out = [];
    foreach ($st as $a) {
        $out[$a['papel']] = [
            'usuarioId' => (string)$a['usuario_id'],
            'nome'      => $a['nome'],
            'matricula' => $a['matricula'],
            'perfil'    => $a['perfil'],
            'em'        => $a['assinado_em'],
        ];
    }
    return $out;
}

/** Qualquer alteração na vistoria aberta desfaz as assinaturas: quem assinou precisa assinar de novo. */
function limparAssinaturas(int $vistoriaId): void
{
    db()->prepare("DELETE a FROM vistoria_assinaturas a JOIN vistorias v ON v.id = a.vistoria_id WHERE a.vistoria_id = ? AND v.status = 'aberta'")
        ->execute([$vistoriaId]);
}

/** SHA-256 do conteúdo da vistoria e das assinaturas, gravado na conclusão. */
function hashVistoria(int $vistoriaId): string
{
    $pdo = db();
    $q = function (string $sql) use ($pdo, $vistoriaId) {
        $st = $pdo->prepare($sql);
        $st->execute([$vistoriaId]);
        return $st->fetchAll();
    };
    $dados = [
        'vistoria'    => $q('SELECT id, veiculo_id, modelo_id, data, setor, km, motorista, matricula, combustivel, obs FROM vistorias WHERE id = ?'),
        'respostas'   => $q('SELECT origem, item_id, item_texto, valor, obs FROM vistoria_respostas WHERE vistoria_id = ? ORDER BY origem, item_id'),
        'avarias'     => $q('SELECT id, parte, tipo, gravidade, obs, foto FROM avarias WHERE vistoria_id = ? ORDER BY id'),
        'assinaturas' => $q('SELECT papel, usuario_id, nome, matricula, assinado_em FROM vistoria_assinaturas WHERE vistoria_id = ? ORDER BY papel'),
    ];
    return hash('sha256', json_encode($dados, JSON_UNESCAPED_UNICODE));
}

/** Código curto para mostrar no carimbo: 7F3A-91C2-0B5E */
function codigoCurto(?string $hash): string
{
    return $hash ? implode('-', str_split(strtoupper(substr($hash, 0, 12)), 4)) : '';
}
