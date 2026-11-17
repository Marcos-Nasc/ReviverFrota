<?php
declare(strict_types=1);

require __DIR__ . '/../src/bootstrap.php';
require __DIR__ . '/../src/dados.php';

exigirLoginPagina();
$pdo = db();
$id = (int)($_GET['id'] ?? 0);

$st = $pdo->prepare(
    'SELECT v.*, ve.placa, ve.descricao, f.nome AS frota, m.nome AS modelo, m.rotulo_sim, m.origem,
            ua.nome AS aberta_nome, uc.nome AS concluida_nome
       FROM vistorias v
       JOIN veiculos ve ON ve.id = v.veiculo_id
       JOIN frotas f ON f.id = ve.frota_id
       JOIN modelos m ON m.id = v.modelo_id
       JOIN usuarios ua ON ua.id = v.aberta_por
  LEFT JOIN usuarios uc ON uc.id = v.concluida_por
      WHERE v.id = ?'
);
$st->execute([$id]);
$v = $st->fetch();
if (!$v) {
    http_response_code(404);
    exit('Vistoria não encontrada.');
}

// Itens: na concluída vale o que foi gravado; na aberta, o checklist atual com as respostas até agora
$st = $pdo->prepare('SELECT * FROM vistoria_respostas WHERE vistoria_id = ? ORDER BY ordem, id');
$st->execute([$id]);
$gravadas = $st->fetchAll();
if ($v['status'] === 'concluida') {
    $itens = $gravadas;
} else {
    $porRef = [];
    foreach ($gravadas as $r) {
        $porRef[$r['origem'] . ':' . $r['item_id']] = $r;
    }
    $itens = [];
    foreach (checklistDoVeiculo(buscarVeiculo((int)$v['veiculo_id']) ?? ['modelo_id' => $v['modelo_id'], 'frota_id' => 0]) as $i) {
        $r = $porRef[$i['origem'] . ':' . $i['id']] ?? [];
        $itens[] = ['secao' => $i['secao'], 'item_texto' => $i['texto'], 'tipo' => $i['tipo'], 'unidade' => $i['unidade'], 'valor' => $r['valor'] ?? null, 'obs' => $r['obs'] ?? null];
    }
}
$secoes = [];
foreach ($itens as $i) {
    $secoes[$i['secao']][] = $i;
}

$st = $pdo->prepare('SELECT * FROM avarias WHERE vistoria_id = ? ORDER BY id');
$st->execute([$id]);
$avarias = $st->fetchAll();
$assinaturas = carregarAssinaturas($id);
$codigo = codigoCurto($v['codigo_verificacao'] ?? null);

$st = $pdo->prepare('SELECT * FROM guia_marcha WHERE veiculo_id = ? AND data <= ? ORDER BY data DESC, id DESC LIMIT 8');
$st->execute([$v['veiculo_id'], $v['data']]);
$guia = $st->fetchAll();

$sim = $v['rotulo_sim'] === 'OK' ? 'OK' : 'Sim';
$fuel = ['E', '1/4', '1/2', '3/4', 'F'];
$grav = ['leve' => 'Leve', 'media' => 'Média', 'grave' => 'Grave'];
$fmt = fn($d, $f = 'd/m/Y') => $d ? date($f, strtotime($d)) : '';
$marca = function (?string $valor, string $alvo): string {
    return $valor === $alvo ? '<span class="x">X</span>' : '';
};
?><!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vistoria <?= e($v['placa']) ?> · <?= e($fmt($v['data'])) ?> · ReviverFrota</title>
<link rel="icon" href="assets/img/favicon.ico" sizes="any">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
  :root{--ink:#0e1a2b;--ink-2:#2c3b50;--muted:#617088;--line:#c9d2dd;--soft:#f2f5f9;--bad:#bf342a;--bad-soft:#fbe6e4;--ok:#17784c;--accent:#0f4c97;--navy:#023d75}
  *{box-sizing:border-box}
  body{margin:0;background:#e6ebf1;color:var(--ink);font:12.5px/1.45 "IBM Plex Sans",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .bar{position:sticky;top:0;z-index:2;display:flex;gap:8px;justify-content:center;padding:12px;background:rgba(230,235,241,.92);backdrop-filter:blur(8px)}
  .bar button,.bar a{border:1px solid #c9d2dd;background:#fff;border-radius:6px;padding:9px 16px;font:500 14px "IBM Plex Sans",Arial,sans-serif;color:var(--ink);text-decoration:none;cursor:pointer}
  .bar button{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
  .folha{background:#fff;width:210mm;min-height:297mm;margin:0 auto 28px;padding:12mm 12mm 10mm;box-shadow:0 8px 30px rgba(14,26,43,.12)}
  @media (max-width:820px){.folha{width:100%;min-height:0;padding:16px}}
  table{width:100%;border-collapse:collapse}
  td,th{border:1px solid var(--line);padding:4px 7px;vertical-align:top;text-align:left}
  th{background:var(--soft);font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-2)}
  .topo{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;background:var(--navy);color:#fff;padding:10px 14px;border-radius:6px 6px 0 0}
  .topo .logo{height:40px;width:auto;display:block}
  .topo .ficha{text-align:center}
  @media (max-width:640px){.topo{grid-template-columns:1fr auto}.topo .ficha{display:none}}
  .topo strong{display:block;font-size:13px;letter-spacing:.02em;text-transform:uppercase;color:#dbe4ef;font-weight:600}
  .topo span{color:#b8c7da;font-size:12px}
  .num{text-align:right;font-size:11px;color:#b8c7da}
  .num b{display:block;color:#fff;font-size:15px}
  .status{display:inline-block;background:#fbe6e4;color:var(--bad);font-weight:600;border-radius:12px;padding:2px 9px;font-size:11px}
  .cab td{height:40px}
  .cab small{display:block;font-size:9.5px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
  .cab b{font-weight:500;font-size:13px}
  .resumo{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-top:0}
  .resumo div{padding:7px 10px;border-left:1px solid var(--line)}
  .resumo div:first-child{border-left:0}
  .resumo small{display:block;font-size:9.5px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
  .resumo b{font-size:16px;font-variant-numeric:tabular-nums}
  .resumo .r b{color:var(--bad)}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
  @media (max-width:640px){.cols{grid-template-columns:1fr}.resumo{grid-template-columns:1fr 1fr}}
  .itens td.m{width:34px;text-align:center;vertical-align:middle}
  .itens .x{font:700 13px "IBM Plex Mono",monospace}
  .itens tr.nok td{background:var(--bad-soft)}
  .itens .sec td{background:var(--soft);font-weight:600;color:var(--ink-2)}
  .itens .ob{display:block;font-size:11px;color:var(--bad)}
  h2{font-size:11.5px;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-2);display:flex;align-items:center;gap:8px}
  h2::after{content:"";flex:1;height:1px;background:var(--line)}
  .fotos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
  .foto{border:1px solid var(--line);border-radius:4px;padding:6px;break-inside:avoid}
  .foto img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;margin-bottom:5px;background:var(--soft);border-radius:2px}
  .foto b{display:block}
  .comb{font:600 15px "IBM Plex Mono",monospace}
  .ass{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:22px;break-inside:avoid}
  .ass>div{display:flex;flex-direction:column;align-items:center;gap:8px}
  .ass .rot{width:100%;border-top:1px solid var(--ink);text-align:center;padding-top:5px;font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em}
  .ass .vazio{height:92px;display:grid;place-items:center;color:var(--muted);font-size:11px}
  .carimbo{position:relative;min-width:230px;max-width:100%;display:flex;flex-direction:column;gap:1px;padding:9px 40px 9px 12px;border:2px solid var(--navy);border-radius:7px;color:var(--navy);
    box-shadow:inset 0 0 0 3px #fff,inset 0 0 0 4px rgba(2,61,117,.55);transform:rotate(-1.2deg)}
  .carimbo .t{font-size:8.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
  .carimbo b{font-size:14px}
  .carimbo .i{font-size:11px;font-weight:600}
  .carimbo .d{font:500 10.5px "IBM Plex Mono",monospace}
  .carimbo .s{position:absolute;right:9px;top:50%;margin-top:-12px;width:24px;height:24px;border:2px solid var(--navy);border-radius:50%;display:grid;place-items:center}
  .verif{margin-top:14px;display:flex;gap:10px;align-items:center;justify-content:center;font-size:11px;color:var(--ink-2)}
  .verif code{font:600 12px "IBM Plex Mono",monospace;letter-spacing:.06em;background:var(--soft);border:1px solid var(--line);border-radius:4px;padding:2px 7px;color:var(--ink)}
  .rod{margin-top:16px;padding-top:8px;border-top:1px solid var(--line);color:var(--muted);font-size:10.5px}
  @media print{body{background:#fff}.bar{display:none}.folha{margin:0;padding:0;width:auto;min-height:0;box-shadow:none}@page{size:A4;margin:9mm}}
</style>
</head>
<body>
<div class="bar"><a href="index.php">Voltar ao sistema</a><button type="button" onclick="window.print()">Imprimir ou salvar PDF</button></div>
<div class="folha">
  <div class="topo">
    <img class="logo" src="assets/img/reviverfrota-logo-negativo.png" alt="ReviverFrota · Concessionária Reviver" height="40">
    <div class="ficha"><strong><?= e($v['origem'] ? preg_replace('/^(Ficha|Sugestão):\s*/u', '', $v['origem']) : 'Controle de qualidade e checklist da frota') ?></strong></div>
    <div class="num"><?= $v['status'] === 'concluida' ? 'Vistoria nº<b>' . (int)$v['id'] . '</b>' : '<span class="status">Em andamento</span>' ?></div>
  </div>
  <table class="cab">
    <tr><td><small>Data</small><b><?= e($fmt($v['data'])) ?></b></td><td><small>Placa</small><b><?= e($v['placa']) ?></b></td><td><small>Setor</small><b><?= e($v['setor']) ?></b></td><td><small>KM</small><b><?= e($v['km']) ?></b></td><td><small>Tipo de veículo</small><b><?= e($v['descricao']) ?></b></td></tr>
    <tr><td colspan="3"><small>Motorista</small><b><?= e($v['motorista']) ?></b></td><td colspan="2"><small>Matrícula</small><b><?= e($v['matricula']) ?></b></td></tr>
  </table>
  <?php
    $tot = count($itens);
    $resp = count(array_filter($itens, fn($i) => $i['valor'] !== null && $i['valor'] !== ''));
    $nao = count(array_filter($itens, fn($i) => $i['valor'] === 'n'));
  ?>
  <div class="resumo">
    <div><small>Itens conferidos</small><b><?= $resp ?>/<?= $tot ?></b></div>
    <div class="<?= $nao ? 'r' : '' ?>"><small>Marcados Não</small><b><?= $nao ?></b></div>
    <div class="<?= count($avarias) ? 'r' : '' ?>"><small>Avarias</small><b><?= count($avarias) ?></b></div>
    <div><small>Combustível</small><b><?= $v['combustivel'] === null ? '—' : e($fuel[(int)$v['combustivel']]) ?></b></div>
  </div>


  <?php
    $blocos = array_chunk($secoes, (int)ceil(max(count($secoes), 1) / 2), true);
  ?>
  <div class="cols">
  <?php foreach ($blocos as $bloco): ?>
    <table class="itens">
      <tr><th>Item</th><th class="m"><?= e($sim) ?></th><th class="m">Não</th><th class="m">N/A</th></tr>
      <?php foreach ($bloco as $nomeSecao => $lista): ?>
        <tr class="sec"><td colspan="4"><?= e($nomeSecao) ?></td></tr>
        <?php foreach ($lista as $i): ?>
          <?php if ($i['tipo'] === 'sn'): ?>
            <tr class="<?= $i['valor'] === 'n' ? 'nok' : '' ?>"><td><?= e($i['item_texto']) ?><?php if ($i['obs']): ?><span class="ob"><?= e($i['obs']) ?></span><?php endif; ?></td>
              <td class="m"><?= $marca($i['valor'], 's') ?></td><td class="m"><?= $marca($i['valor'], 'n') ?></td><td class="m"><?= $marca($i['valor'], 'na') ?></td></tr>
          <?php else: ?>
            <tr><td><?= e($i['item_texto']) ?></td><td colspan="3"><?= e($i['valor']) ?> <?= e($i['unidade']) ?></td></tr>
          <?php endif; ?>
        <?php endforeach; ?>
      <?php endforeach; ?>
    </table>
  <?php endforeach; ?>
  </div>

  <h2>Observações</h2>
  <table><tr><td><?= nl2br(e($v['obs'] ?: 'Sem observações.')) ?></td></tr></table>

  <h2>Lataria · <?= count($avarias) ?> avaria(s)</h2>
  <?php if (!$avarias): ?><p>Nenhuma avaria registrada.</p><?php else: ?>
    <div class="fotos">
      <?php foreach ($avarias as $n => $a): ?>
        <div class="foto">
          <?php if ($a['foto']): ?><img src="api.php?action=foto&id=<?= (int)$a['id'] ?>" alt="Foto da avaria <?= $n + 1 ?>"><?php endif; ?>
          <b><?= $n + 1 ?>. <?= e($a['parte']) ?></b>
          <?= e($a['tipo']) ?> · <?= e($grav[$a['gravidade']] ?? '') ?><?= $a['obs'] ? '<br>' . e($a['obs']) : '' ?>
        </div>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>

  <?php if ($guia): ?>
  <h2>Guia de marcha</h2>
  <table>
    <tr><th>Data</th><th>Motorista</th><th>Hora</th><th>KM inicial</th><th>Destino</th><th>Hora</th><th>KM final</th></tr>
    <?php foreach ($guia as $g): ?>
      <tr><td><?= e($fmt($g['data'])) ?></td><td><?= e($g['motorista']) ?></td><td><?= e(substr((string)$g['hora'], 0, 5)) ?></td><td><?= e($g['km_inicial']) ?></td><td><?= e($g['destino']) ?></td><td><?= e(substr((string)$g['hora_chegada'], 0, 5)) ?></td><td><?= e($g['km_final']) ?></td></tr>
    <?php endforeach; ?>
  </table>
  <?php endif; ?>

  <div class="ass">
    <?php foreach (['motorista' => 'Assinatura do motorista', 'vistoriador' => 'Assinatura do vistoriador'] as $papel => $rotulo): $a = $assinaturas[$papel] ?? null; ?>
      <div>
        <?php if ($a): ?>
          <div class="carimbo">
            <span class="t">Assinado eletronicamente</span>
            <b><?= e($a['nome']) ?></b>
            <span class="i"><?= $papel === 'motorista' ? 'Motorista' : 'Vistoriador' ?><?= $a['matricula'] !== '' ? ' · Mat. ' . e($a['matricula']) : '' ?></span>
            <span class="d"><?= e($fmt($a['em'], 'd/m/Y H:i:s')) ?></span>
            <span class="s"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M5 12l4 4 10-10"/></svg></span>
          </div>
        <?php else: ?>
          <div class="vazio">Aguardando assinatura</div>
        <?php endif; ?>
        <span class="rot"><?= $rotulo ?></span>
      </div>
    <?php endforeach; ?>
  </div>
  <?php if ($codigo): ?>
    <p class="verif">Código de verificação <code><?= e($codigo) ?></code> · assinaturas eletrônicas feitas com usuário e senha no ReviverFrota</p>
  <?php endif; ?>
  <p class="rod">Aberta por <?= e($v['aberta_nome']) ?> em <?= e($fmt($v['iniciada_em'], 'd/m/Y H:i')) ?><?= $v['concluida_em'] ? ' · Concluída por ' . e($v['concluida_nome']) . ' em ' . e($fmt($v['concluida_em'], 'd/m/Y H:i')) : '' ?> · Checklist: <?= e($v['modelo']) ?> · Frota: <?= e($v['frota']) ?></p>
</div>
</body>
</html>
