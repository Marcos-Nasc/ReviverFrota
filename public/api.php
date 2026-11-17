<?php
declare(strict_types=1);

require __DIR__ . '/../src/bootstrap.php';
require __DIR__ . '/../src/dados.php';

/* ---------- respostas ---------- */

function ok(array $dados = []): never
{
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => true] + $dados, JSON_UNESCAPED_UNICODE);
    exit;
}

function erro(string $msg, int $codigo = 400): never
{
    http_response_code($codigo);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'erro' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

set_exception_handler(function (Throwable $e) {
    error_log('[checklist-frota] ' . $e->getMessage() . ' em ' . $e->getFile() . ':' . $e->getLine());
    erro(cfg('debug') ? $e->getMessage() : 'Erro interno. Tente de novo ou avise o suporte.', 500);
});

/* ---------- entrada ---------- */

$acao = (string)($_GET['action'] ?? '');
$u = usuario();
if (!$u) {
    erro('Sua sessão expirou. Entre de novo.', 401);
}
if ($u['perfil'] === 'motorista') {
    erro('Usuários de motorista só assinam vistorias.', 403);
}
$uid = (int)$u['id'];

$metodo = $_SERVER['REQUEST_METHOD'];
$in = [];
if ($metodo === 'POST') {
    if (!csrfValido($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null)) {
        erro('Token de segurança inválido. Recarregue a página.', 403);
    }
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    if (str_starts_with($ct, 'application/json')) {
        $in = json_decode((string)file_get_contents('php://input'), true) ?: [];
    } else {
        $in = $_POST;
    }
}
// Libera a sessão para não travar requisições paralelas do mesmo usuário
session_write_close();

function campo(string $k, mixed $padrao = null): mixed
{
    global $in;
    return $in[$k] ?? $padrao;
}

function intCampo(string $k): int
{
    $v = campo($k);
    if (!is_numeric($v) || (int)$v <= 0) {
        erro("Campo inválido: $k.");
    }
    return (int)$v;
}

/** Aceita "m12", "x3", "s5" ou "12" e devolve o número. */
function idRef(mixed $ref, string $prefixo = ''): ?int
{
    $ref = (string)$ref;
    if ($prefixo !== '' && str_starts_with($ref, $prefixo)) {
        $ref = substr($ref, strlen($prefixo));
    }
    return ctype_digit($ref) ? (int)$ref : null;
}

function texto(mixed $v, int $max, bool $obrigatorio = false, string $nome = 'campo'): string
{
    $t = trim((string)$v);
    if ($obrigatorio && $t === '') {
        erro("Preencha $nome.");
    }
    return mb_substr($t, 0, $max);
}

function exigirAdmin(): void
{
    if (!eAdmin()) {
        erro('Só administradores podem alterar cadastros.', 403);
    }
}

function exigirPost(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        erro('Método não permitido.', 405);
    }
}

/** Carrega a vistoria e garante que ainda está aberta. */
function vistoriaEditavel(int $id): array
{
    $st = db()->prepare('SELECT * FROM vistorias WHERE id = ?');
    $st->execute([$id]);
    $v = $st->fetch();
    if (!$v) {
        erro('Vistoria não encontrada.', 404);
    }
    if ($v['status'] !== 'aberta') {
        erro('Esta vistoria já foi concluída e não pode ser alterada.');
    }
    return $v;
}

function avariaEditavel(int $id): array
{
    $st = db()->prepare('SELECT * FROM avarias WHERE id = ?');
    $st->execute([$id]);
    $a = $st->fetch();
    if (!$a) {
        erro('Avaria não encontrada.', 404);
    }
    vistoriaEditavel((int)$a['vistoria_id']);
    return $a;
}

/* ---------- arquivos ---------- */

function pastaUploads(): string
{
    $p = rtrim((string)cfg('uploads'), '/');
    if (!is_dir($p) && !@mkdir($p, 0775, true)) {
        erro('A pasta de uploads não existe e não pôde ser criada. Verifique config.php.', 500);
    }
    return $p;
}

function salvarFoto(array $f): string
{
    if (($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        erro('A foto não chegou ao servidor. Tente de novo.');
    }
    $max = (int)(cfg('foto_max_mb') ?? 8) * 1024 * 1024;
    if ($f['size'] > $max) {
        erro('A foto passa do tamanho máximo permitido.');
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
    if (!$ext || @getimagesize($f['tmp_name']) === false) {
        erro('Envie uma imagem JPG, PNG ou WEBP.');
    }
    $rel = 'avarias/' . date('Y/m') . '/' . bin2hex(random_bytes(12)) . '.' . $ext;
    $abs = pastaUploads() . '/' . $rel;
    if (!is_dir(dirname($abs))) {
        mkdir(dirname($abs), 0775, true);
    }
    if (!move_uploaded_file($f['tmp_name'], $abs)) {
        erro('Não foi possível gravar a foto no servidor.', 500);
    }
    return $rel;
}

function enviarArquivo(?string $rel): never
{
    $base = realpath(pastaUploads());
    $abs = $rel ? realpath($base . '/' . $rel) : false;
    if (!$abs || !str_starts_with($abs, $base . DIRECTORY_SEPARATOR) || !is_file($abs)) {
        http_response_code(404);
        exit;
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($abs);
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($abs));
    header('Cache-Control: private, max-age=86400');
    readfile($abs);
    exit;
}

/* ---------- ações ---------- */

$pdo = db();

switch ($acao) {

    /* ===== leitura geral ===== */

    case 'bootstrap':
        ok([
            'modelos'  => carregarModelos(),
            'frotas'   => carregarFrotas(),
            'veiculos' => carregarVeiculos(),
        ]);

    case 'foto':
        $st = $pdo->prepare('SELECT foto FROM avarias WHERE id = ?');
        $st->execute([(int)($_GET['id'] ?? 0)]);
        enviarArquivo($st->fetchColumn() ?: null);

    /* ===== vistoria ===== */

    case 'vistoria':
        $veic = buscarVeiculo((int)($_GET['veiculo_id'] ?? 0));
        if (!$veic) {
            erro('Veículo não encontrado.', 404);
        }
        ok(['vistoria' => dadosVistoria(vistoriaAberta($veic, $uid))]);

    case 'ficha':
        exigirPost();
        $v = vistoriaEditavel(intCampo('vistoria_id'));
        $mapa = ['data' => 'data', 'setor' => 'setor', 'km' => 'km', 'motorista' => 'motorista', 'matricula' => 'matricula', 'comb' => 'combustivel', 'obs' => 'obs'];
        $c = (string)campo('campo');
        if (!isset($mapa[$c])) {
            erro('Campo da ficha desconhecido.');
        }
        $valor = campo('valor');
        $valor = match ($c) {
            'data'  => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$valor) ? $valor : erro('Data inválida.'),
            'km'    => ($valor === '' || $valor === null) ? null : (ctype_digit((string)$valor) ? (int)$valor : erro('KM deve ser um número inteiro.')),
            'comb'  => ($valor === null || $valor === '') ? null : (in_array((int)$valor, [0, 1, 2, 3, 4], true) ? (int)$valor : erro('Nível de combustível inválido.')),
            'obs'   => texto($valor, 5000),
            default => texto($valor, $c === 'matricula' ? 40 : 120),
        };
        $pdo->prepare("UPDATE vistorias SET {$mapa[$c]} = ? WHERE id = ?")->execute([$valor, $v['id']]);
        limparAssinaturas((int)$v['id']);
        ok();

    case 'responder':
        exigirPost();
        $v = vistoriaEditavel(intCampo('vistoria_id'));
        $ref = (string)campo('ref');
        $origem = str_starts_with($ref, 'x') ? 'frota' : 'modelo';
        $itemId = idRef(substr($ref, 1));
        if (!$itemId) {
            erro('Item inválido.');
        }
        $veic = buscarVeiculo((int)$v['veiculo_id']);
        $item = null;
        foreach (checklistDoVeiculo($veic) as $ordem => $i) {
            if ($i['origem'] === $origem && $i['id'] === $itemId) {
                $item = $i + ['ordem' => $ordem];
                break;
            }
        }
        if (!$item) {
            erro('Este item não faz parte do checklist deste veículo.');
        }
        $temValor = array_key_exists('valor', $in);
        $temObs = array_key_exists('obs', $in);
        $valor = $temValor && campo('valor') !== null ? texto(campo('valor'), 255) : null;
        if ($temValor && $valor !== null && $item['tipo'] === 'sn' && !in_array($valor, ['s', 'n', 'na'], true)) {
            erro('Resposta inválida.');
        }
        if ($temValor && $valor !== null && $item['tipo'] === 'num' && $valor !== '' && !is_numeric(str_replace(',', '.', $valor))) {
            erro('Informe um número.');
        }
        $obs = $temObs ? texto(campo('obs'), 255) : null;
        $sql = 'INSERT INTO vistoria_respostas (vistoria_id, origem, item_id, secao, item_texto, tipo, unidade, valor, obs, ordem)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE secao = VALUES(secao), item_texto = VALUES(item_texto), ordem = VALUES(ordem)'
            . ($temValor ? ', valor = VALUES(valor)' : '')
            . ($temObs ? ', obs = VALUES(obs)' : '');
        $pdo->prepare($sql)->execute([$v['id'], $origem, $itemId, $item['secao'], $item['texto'], $item['tipo'], $item['unidade'], $valor, $obs, $item['ordem']]);
        limparAssinaturas((int)$v['id']);
        ok();

    case 'avaria_criar':
        exigirPost();
        $v = vistoriaEditavel(intCampo('vistoria_id'));
        $grav = (string)campo('grav');
        if (!in_array($grav, ['leve', 'media', 'grave'], true)) {
            erro('Gravidade inválida.');
        }
        $lado = campo('lado');
        $lado = in_array($lado, ['e', 'd'], true) ? $lado : null;
        $pos = json_decode((string)campo('pos', 'null'), true);
        $pos = is_array($pos) && count($pos) === 3 ? array_map('floatval', $pos) : [null, null, null];
        $foto = isset($_FILES['foto']) && $_FILES['foto']['error'] !== UPLOAD_ERR_NO_FILE ? salvarFoto($_FILES['foto']) : null;
        $pdo->prepare('INSERT INTO avarias (vistoria_id, peca_chave, lado, parte, tipo, gravidade, obs, foto, pos_x, pos_y, pos_z, criado_por) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
            ->execute([
                $v['id'], texto(campo('key'), 40, true, 'a peça'), $lado, texto(campo('parte'), 120, true, 'a peça'),
                texto(campo('tipo'), 30, true, 'o tipo de avaria'), $grav, texto(campo('obs'), 2000), $foto, $pos[0], $pos[1], $pos[2], $uid,
            ]);
        $st = $pdo->prepare('SELECT * FROM avarias WHERE id = ?');
        $st->execute([$pdo->lastInsertId()]);
        limparAssinaturas((int)$v['id']);
        ok(['avaria' => formatarAvaria($st->fetch())]);

    case 'avaria_foto':
        exigirPost();
        $a = avariaEditavel(intCampo('id'));
        if (!isset($_FILES['foto'])) {
            erro('Escolha uma foto.');
        }
        $rel = salvarFoto($_FILES['foto']);
        $pdo->prepare('UPDATE avarias SET foto = ? WHERE id = ?')->execute([$rel, $a['id']]);
        if ($a['foto']) {
            @unlink(pastaUploads() . '/' . $a['foto']);
        }
        $a['foto'] = $rel;
        limparAssinaturas((int)$a['vistoria_id']);
        ok(['avaria' => formatarAvaria($a)]);

    case 'avaria_pos':
        exigirPost();
        $a = avariaEditavel(intCampo('id'));
        $pos = campo('pos');
        if (!is_array($pos) || count($pos) !== 3) {
            erro('Posição inválida.');
        }
        $pdo->prepare('UPDATE avarias SET pos_x = ?, pos_y = ?, pos_z = ? WHERE id = ?')->execute([(float)$pos[0], (float)$pos[1], (float)$pos[2], $a['id']]);
        ok();

    case 'avaria_excluir':
        exigirPost();
        $a = avariaEditavel(intCampo('id'));
        $pdo->prepare('DELETE FROM avarias WHERE id = ?')->execute([$a['id']]);
        if ($a['foto']) {
            @unlink(pastaUploads() . '/' . $a['foto']);
        }
        limparAssinaturas((int)$a['vistoria_id']);
        ok();

    case 'guia_criar':
        exigirPost();
        $veic = buscarVeiculo(intCampo('veiculo_id'));
        if (!$veic) {
            erro('Veículo não encontrado.', 404);
        }
        $data = (string)campo('data');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $data)) {
            erro('Data inválida.');
        }
        $hora = fn($h) => preg_match('/^\d{2}:\d{2}$/', (string)$h) ? $h : null;
        $km = fn($k) => ctype_digit((string)$k) ? (int)$k : null;
        $pdo->prepare('INSERT INTO guia_marcha (veiculo_id, data, hora, motorista, destino, km_inicial, km_final, hora_chegada, criado_por) VALUES (?,?,?,?,?,?,?,?,?)')
            ->execute([$veic['id'], $data, $hora(campo('hora')), texto(campo('motorista'), 120, true, 'o motorista'), texto(campo('destino'), 200, true, 'o destino'),
                $km(campo('kmIni')), $km(campo('kmFim')), $hora(campo('horaF')), $uid]);
        $vid = vistoriaAberta($veic, $uid);
        ok(['guia' => dadosVistoria($vid)['guia']]);

    case 'concluir':
        exigirPost();
        $v = vistoriaEditavel(intCampo('vistoria_id'));
        $ass = carregarAssinaturas((int)$v['id']);
        if (empty($ass['motorista']) || empty($ass['vistoriador'])) {
            erro('A vistoria precisa das assinaturas do motorista e do vistoriador.');
        }
        $veic = buscarVeiculo((int)$v['veiculo_id']);
        $itens = checklistDoVeiculo($veic);

        $pdo->beginTransaction();
        // grava a foto final do checklist: todo item vira uma linha, respondido ou não
        $ins = $pdo->prepare(
            'INSERT INTO vistoria_respostas (vistoria_id, origem, item_id, secao, item_texto, tipo, unidade, ordem)
             VALUES (?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE secao = VALUES(secao), item_texto = VALUES(item_texto), tipo = VALUES(tipo), unidade = VALUES(unidade), ordem = VALUES(ordem)'
        );
        $validos = [];
        foreach ($itens as $ordem => $i) {
            $ins->execute([$v['id'], $i['origem'], $i['id'], $i['secao'], $i['texto'], $i['tipo'], $i['unidade'], $ordem]);
            $validos[] = $i['origem'] . ':' . $i['id'];
        }
        // respostas de itens que saíram do checklist durante a vistoria não contam
        $st = $pdo->prepare('SELECT id, origem, item_id FROM vistoria_respostas WHERE vistoria_id = ?');
        $st->execute([$v['id']]);
        $del = $pdo->prepare('DELETE FROM vistoria_respostas WHERE id = ?');
        foreach ($st->fetchAll() as $r) {
            if (!in_array($r['origem'] . ':' . $r['item_id'], $validos, true)) {
                $del->execute([$r['id']]);
            }
        }
        $st = $pdo->prepare("SELECT COUNT(*) total, SUM(valor IS NOT NULL AND valor <> '') resp, SUM(valor = 'n') nao FROM vistoria_respostas WHERE vistoria_id = ?");
        $st->execute([$v['id']]);
        $c = $st->fetch();
        $pdo->prepare("UPDATE vistorias SET status = 'concluida', concluida_em = NOW(), concluida_por = ?, total_itens = ?, itens_respondidos = ?, itens_nao = ?
                       WHERE id = ? AND status = 'aberta'")
            ->execute([$uid, (int)$c['total'], (int)$c['resp'], (int)$c['nao'], $v['id']]);
        $pdo->prepare('UPDATE vistorias SET codigo_verificacao = ? WHERE id = ?')->execute([hashVistoria((int)$v['id']), $v['id']]);
        $pdo->commit();

        $nova = vistoriaAberta($veic, $uid);
        ok(['concluida' => (string)$v['id'], 'vistoria' => dadosVistoria($nova)]);

    case 'assinar':
        exigirPost();
        $v = vistoriaEditavel(intCampo('vistoria_id'));
        $papel = campo('papel') === 'motorista' ? 'motorista' : 'vistoriador';
        $senha = (string)campo('senha', '');
        // limite de tentativas por sessão: 5 erros por minuto
        session_start();
        $t = $_SESSION['ass_tent'] ?? ['n' => 0, 'em' => 0];
        if ($t['n'] >= 5 && time() - $t['em'] < 60) {
            session_write_close();
            erro('Muitas tentativas de assinatura. Aguarde um minuto.', 429);
        }
        if (time() - $t['em'] >= 60) {
            $t = ['n' => 0, 'em' => 0];
        }
        if ($papel === 'vistoriador') {
            $st = $pdo->prepare('SELECT id, nome, matricula, perfil, senha_hash FROM usuarios WHERE id = ? AND ativo = 1');
            $st->execute([$uid]);
        } else {
            $st = $pdo->prepare('SELECT id, nome, matricula, perfil, senha_hash FROM usuarios WHERE login = ? AND ativo = 1');
            $st->execute([trim((string)campo('login', ''))]);
        }
        $quem = $st->fetch();
        if (!$quem || !password_verify($senha, $quem['senha_hash'])) {
            $_SESSION['ass_tent'] = ['n' => $t['n'] + 1, 'em' => time()];
            session_write_close();
            usleep(400000);
            erro($papel === 'vistoriador' ? 'Senha incorreta.' : 'Usuário ou senha do motorista incorretos.');
        }
        unset($_SESSION['ass_tent']);
        session_write_close();
        if ($papel === 'vistoriador' && $quem['perfil'] === 'motorista') {
            erro('Este usuário não tem perfil de vistoriador.');
        }
        $outro = carregarAssinaturas((int)$v['id'])[$papel === 'motorista' ? 'vistoriador' : 'motorista'] ?? null;
        if ($outro && (int)$outro['usuarioId'] === (int)$quem['id']) {
            erro('A mesma pessoa não pode assinar como motorista e como vistoriador.');
        }
        $pdo->prepare(
            'INSERT INTO vistoria_assinaturas (vistoria_id, papel, usuario_id, nome, matricula, perfil, assinado_em, ip, dispositivo)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?)
             ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id), nome = VALUES(nome), matricula = VALUES(matricula), perfil = VALUES(perfil),
                                     assinado_em = VALUES(assinado_em), ip = VALUES(ip), dispositivo = VALUES(dispositivo)'
        )->execute([$v['id'], $papel, $quem['id'], $quem['nome'], $quem['matricula'], $quem['perfil'],
            substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45), mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255)]);
        if ($papel === 'motorista') {
            // a ficha passa a mostrar o motorista que assinou
            $pdo->prepare('UPDATE vistorias SET motorista = ?, matricula = IF(? <> \'\', ?, matricula) WHERE id = ?')
                ->execute([$quem['nome'], $quem['matricula'], $quem['matricula'], $v['id']]);
        }
        $d = dadosVistoria((int)$v['id']);
        ok(['assinaturas' => $d['assinaturas'], 'ficha' => $d['ficha']]);

    case 'assinatura_remover':
        exigirPost();
        $v = vistoriaEditavel(intCampo('vistoria_id'));
        $pdo->prepare('DELETE FROM vistoria_assinaturas WHERE vistoria_id = ? AND papel = ?')
            ->execute([$v['id'], campo('papel') === 'motorista' ? 'motorista' : 'vistoriador']);
        ok(['assinaturas' => (object)carregarAssinaturas((int)$v['id'])]);

    /* ===== usuários (admin) ===== */

    case 'usuarios':
        exigirAdmin();
        $lista = $pdo->query('SELECT id, nome, login, matricula, perfil, ativo, ultimo_acesso FROM usuarios ORDER BY ativo DESC, perfil, nome')->fetchAll();
        ok(['usuarios' => array_map(fn($x) => [
            'id' => (string)$x['id'], 'nome' => $x['nome'], 'login' => $x['login'], 'matricula' => $x['matricula'],
            'perfil' => $x['perfil'], 'ativo' => (bool)$x['ativo'], 'ultimoAcesso' => $x['ultimo_acesso'],
        ], $lista)]);

    case 'usuario_salvar':
        exigirPost();
        exigirAdmin();
        $id = idRef(campo('id', ''));
        $nome = texto(campo('nome'), 120, true, 'o nome');
        $login = strtolower(texto(campo('login'), 60, true, 'o usuário'));
        if (!preg_match('/^[a-z0-9._-]{3,60}$/', $login)) {
            erro('O usuário deve ter de 3 a 60 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.');
        }
        $perfil = in_array(campo('perfil'), ['admin', 'vistoriador', 'motorista'], true) ? campo('perfil') : 'vistoriador';
        $matricula = texto(campo('matricula', ''), 40);
        $senha = (string)campo('senha', '');
        if ((!$id || $senha !== '') && mb_strlen($senha) < 6) {
            erro('A senha precisa ter pelo menos 6 caracteres.');
        }
        $st = $pdo->prepare('SELECT COUNT(*) FROM usuarios WHERE login = ? AND id <> ?');
        $st->execute([$login, $id ?: 0]);
        if ($st->fetchColumn() > 0) {
            erro('Já existe um usuário com esse login.');
        }
        if ($id === $uid && $perfil !== 'admin') {
            erro('Você não pode tirar o seu próprio perfil de administrador.');
        }
        if ($id) {
            $pdo->prepare('UPDATE usuarios SET nome = ?, login = ?, matricula = ?, perfil = ? WHERE id = ?')->execute([$nome, $login, $matricula, $perfil, $id]);
            if ($senha !== '') {
                $pdo->prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?')->execute([password_hash($senha, PASSWORD_DEFAULT), $id]);
            }
        } else {
            $pdo->prepare('INSERT INTO usuarios (nome, login, matricula, perfil, senha_hash) VALUES (?,?,?,?,?)')
                ->execute([$nome, $login, $matricula, $perfil, password_hash($senha, PASSWORD_DEFAULT)]);
        }
        ok();

    case 'usuario_ativo':
        exigirPost();
        exigirAdmin();
        $id = idRef(campo('id', ''));
        if ($id === $uid) {
            erro('Você não pode desativar o seu próprio usuário.');
        }
        $pdo->prepare('UPDATE usuarios SET ativo = ? WHERE id = ?')->execute([campo('ativo') ? 1 : 0, $id]);
        ok();

    /* ===== cadastros (admin) ===== */

    case 'modelo_salvar':
        exigirPost();
        exigirAdmin();
        $m = campo('modelo');
        if (!is_array($m)) {
            erro('Modelo inválido.');
        }
        $base = in_array($m['base'] ?? '', BASES_3D, true) ? $m['base'] : 'carro';
        $rot = ($m['rot'][0] ?? 'Sim') === 'OK' ? 'OK' : 'Sim';
        $nome = texto($m['nome'] ?? '', 100, true, 'o nome do modelo');
        $pdo->beginTransaction();
        $mid = idRef($m['id'] ?? '');
        if ($mid) {
            $pdo->prepare('UPDATE modelos SET nome = ?, base3d = ?, rotulo_sim = ? WHERE id = ? AND ativo = 1')->execute([$nome, $base, $rot, $mid]);
        } else {
            $pdo->prepare('INSERT INTO modelos (nome, base3d, rotulo_sim, origem) VALUES (?,?,?,?)')->execute([$nome, $base, $rot, texto($m['origem'] ?? '', 150)]);
            $mid = (int)$pdo->lastInsertId();
        }
        $st = $pdo->prepare('SELECT id FROM modelo_secoes WHERE modelo_id = ? AND ativo = 1');
        $st->execute([$mid]);
        $secoesAntes = array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
        $secoesMantidas = [];
        foreach (array_values($m['secoes'] ?? []) as $so => $s) {
            $sid = idRef($s['id'] ?? '', 's');
            $sNome = texto($s['nome'] ?? '', 100) ?: 'Seção';
            if ($sid && in_array($sid, $secoesAntes, true)) {
                $pdo->prepare('UPDATE modelo_secoes SET nome = ?, ordem = ? WHERE id = ?')->execute([$sNome, $so + 1, $sid]);
            } else {
                $pdo->prepare('INSERT INTO modelo_secoes (modelo_id, nome, ordem) VALUES (?,?,?)')->execute([$mid, $sNome, $so + 1]);
                $sid = (int)$pdo->lastInsertId();
            }
            $secoesMantidas[] = $sid;
            $st = $pdo->prepare('SELECT id FROM modelo_itens WHERE secao_id = ? AND ativo = 1');
            $st->execute([$sid]);
            $itensAntes = array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
            $itensMantidos = [];
            foreach (array_values($s['itens'] ?? []) as $io => $i) {
                $iid = idRef($i['id'] ?? '', 'm');
                $tipo = in_array($i['tipo'] ?? '', ['sn', 'num', 'texto'], true) ? $i['tipo'] : 'sn';
                $vals = [texto($i['texto'] ?? '', 200) ?: 'Item', $tipo, texto($i['un'] ?? '', 12), !empty($i['obs']) ? 1 : 0, $io + 1];
                if ($iid && in_array($iid, $itensAntes, true)) {
                    $pdo->prepare('UPDATE modelo_itens SET texto = ?, tipo = ?, unidade = ?, pede_obs = ?, ordem = ? WHERE id = ?')->execute([...$vals, $iid]);
                } else {
                    $pdo->prepare('INSERT INTO modelo_itens (texto, tipo, unidade, pede_obs, ordem, secao_id) VALUES (?,?,?,?,?,?)')->execute([...$vals, $sid]);
                    $iid = (int)$pdo->lastInsertId();
                }
                $itensMantidos[] = $iid;
            }
            // itens removidos são desativados (não apagados) para manter o histórico
            foreach (array_diff($itensAntes, $itensMantidos) as $x) {
                $pdo->prepare('UPDATE modelo_itens SET ativo = 0 WHERE id = ?')->execute([$x]);
            }
        }
        foreach (array_diff($secoesAntes, $secoesMantidas) as $x) {
            $pdo->prepare('UPDATE modelo_secoes SET ativo = 0 WHERE id = ?')->execute([$x]);
            $pdo->prepare('UPDATE modelo_itens SET ativo = 0 WHERE secao_id = ?')->execute([$x]);
        }
        $pdo->commit();
        ok(['modelo' => carregarModelos($mid)[0]]);

    case 'modelo_excluir':
        exigirPost();
        exigirAdmin();
        $mid = idRef(campo('id'));
        $st = $pdo->prepare('SELECT COUNT(*) FROM veiculos WHERE modelo_id = ? AND ativo = 1');
        $st->execute([$mid]);
        if ($st->fetchColumn() > 0) {
            erro('Troque o modelo dos veículos antes de excluir.');
        }
        $pdo->prepare('UPDATE modelos SET ativo = 0 WHERE id = ?')->execute([$mid]);
        ok();

    case 'frota_salvar':
        exigirPost();
        exigirAdmin();
        $fid = idRef(campo('id', ''));
        $nome = texto(campo('nome'), 100, true, 'o nome da frota');
        $setor = texto(campo('setor', ''), 100);
        if ($fid) {
            $pdo->prepare('UPDATE frotas SET nome = ?, setor = ? WHERE id = ?')->execute([$nome, $setor, $fid]);
        } else {
            $pdo->prepare('INSERT INTO frotas (nome, setor) VALUES (?, ?)')->execute([$nome, $setor]);
            $fid = (int)$pdo->lastInsertId();
        }
        ok(['id' => (string)$fid, 'frotas' => carregarFrotas()]);

    case 'frota_excluir':
        exigirPost();
        exigirAdmin();
        $fid = idRef(campo('id'));
        $st = $pdo->prepare('SELECT COUNT(*) FROM veiculos WHERE frota_id = ? AND ativo = 1');
        $st->execute([$fid]);
        if ($st->fetchColumn() > 0) {
            erro('Remova ou transfira os veículos antes de excluir a frota.');
        }
        $pdo->prepare('UPDATE frotas SET ativo = 0 WHERE id = ?')->execute([$fid]);
        ok(['frotas' => carregarFrotas()]);

    case 'extra_criar':
        exigirPost();
        exigirAdmin();
        $fid = idRef(campo('frota_id'));
        $tipo = in_array(campo('tipo'), ['sn', 'num', 'texto'], true) ? campo('tipo') : 'sn';
        $mid = idRef(campo('modelo_id', ''));
        $pdo->prepare('INSERT INTO frota_itens_extras (frota_id, modelo_id, secao, texto, tipo, unidade) VALUES (?,?,?,?,?,?)')
            ->execute([$fid, $mid ?: null, texto(campo('secao'), 100, true, 'a seção'), texto(campo('texto'), 200, true, 'o item'), $tipo, texto(campo('un', ''), 12)]);
        ok(['frotas' => carregarFrotas()]);

    case 'extra_excluir':
        exigirPost();
        exigirAdmin();
        $pdo->prepare('UPDATE frota_itens_extras SET ativo = 0 WHERE id = ?')->execute([idRef(campo('id'), 'x')]);
        ok(['frotas' => carregarFrotas()]);

    case 'oculto':
        exigirPost();
        exigirAdmin();
        $fid = idRef(campo('frota_id'));
        $iid = idRef(campo('item'), 'm');
        if (!$fid || !$iid) {
            erro('Dados inválidos.');
        }
        if (campo('oculto')) {
            $pdo->prepare('INSERT IGNORE INTO frota_itens_ocultos (frota_id, item_id) VALUES (?, ?)')->execute([$fid, $iid]);
        } else {
            $pdo->prepare('DELETE FROM frota_itens_ocultos WHERE frota_id = ? AND item_id = ?')->execute([$fid, $iid]);
        }
        ok(['frotas' => carregarFrotas()]);

    case 'veiculo_salvar':
        exigirPost();
        exigirAdmin();
        $vid = idRef(campo('id', ''));
        $base = campo('base');
        $base = in_array($base, BASES_3D, true) ? $base : null;
        $cor = campo('cor');
        $cor = is_numeric($cor) && $cor >= 0 && $cor <= 0xFFFFFF ? (int)$cor : null;
        $mid = idRef(campo('modeloId'));
        $fid = idRef(campo('frotaId'));
        if (!$mid || !$fid) {
            erro('Escolha o modelo e a frota.');
        }
        if ($vid) {
            $atual = buscarVeiculo($vid);
            if (!$atual) {
                erro('Veículo não encontrado.', 404);
            }
            $pdo->prepare('UPDATE veiculos SET descricao = ?, modelo_id = ?, frota_id = ?, base3d = ?, cor = ? WHERE id = ?')
                ->execute([texto(campo('desc', $atual['descricao']), 120) ?: $atual['descricao'], $mid, $fid, $base, $cor, $vid]);
            if ($base !== $atual['base3d']) {
                // visual mudou: as avarias da vistoria aberta são reposicionadas pelo front
                $pdo->prepare("UPDATE avarias a JOIN vistorias v ON v.id = a.vistoria_id SET a.pos_x = NULL, a.pos_y = NULL, a.pos_z = NULL
                               WHERE v.veiculo_id = ? AND v.status = 'aberta'")->execute([$vid]);
                $pdo->prepare("UPDATE vistorias SET base3d = ? WHERE veiculo_id = ? AND status = 'aberta'")->execute([$base ?? 'carro', $vid]);
            }
        } else {
            $placa = strtoupper(preg_replace('/[^A-Za-z0-9-]/', '', (string)campo('placa')));
            if (strlen($placa) < 5) {
                erro('Informe a placa (ex.: ABC1D23).');
            }
            $st = $pdo->prepare('SELECT COUNT(*) FROM veiculos WHERE placa = ?');
            $st->execute([$placa]);
            if ($st->fetchColumn() > 0) {
                erro('Já existe um veículo com essa placa.');
            }
            $pdo->prepare('INSERT INTO veiculos (placa, descricao, modelo_id, frota_id, base3d, cor) VALUES (?,?,?,?,?,?)')
                ->execute([$placa, texto(campo('desc'), 120, true, 'a descrição'), $mid, $fid, $base, $cor]);
            $vid = (int)$pdo->lastInsertId();
        }
        ok(['id' => (string)$vid, 'veiculos' => carregarVeiculos()]);

    case 'veiculo_excluir':
        exigirPost();
        exigirAdmin();
        $vid = idRef(campo('id'));
        // mantém o histórico: desativa e libera a placa para um novo cadastro
        $pdo->prepare("UPDATE veiculos SET ativo = 0, placa = CONCAT(placa, '#', id) WHERE id = ? AND ativo = 1")->execute([$vid]);
        ok(['veiculos' => carregarVeiculos()]);

    default:
        erro('Ação desconhecida.', 404);
}
