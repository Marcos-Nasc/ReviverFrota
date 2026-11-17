<?php
declare(strict_types=1);

require __DIR__ . '/../src/bootstrap.php';
$u = exigirLoginPagina();
$admin = $u['perfil'] === 'admin';
$iniciais = mb_strtoupper(implode('', array_map(fn($p) => mb_substr($p, 0, 1), array_slice(preg_split('/\s+/', trim($u['nome'])) ?: ['?'], 0, 2))));
?><!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="csrf" content="<?= e(csrf()) ?>">
<title>ReviverFrota</title>
<link rel="icon" href="assets/img/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="assets/img/favicon-32.png">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
<meta name="theme-color" content="#023d75">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<script>try{document.documentElement.setAttribute('data-theme',localStorage.getItem('reviver-checklist-tema')||'light')}catch(e){document.documentElement.setAttribute('data-theme','light')}</script>
<link rel="stylesheet" href="assets/app.css?v=5">
<script type="application/json" id="usuario-json"><?= json_encode(['id' => (string)$u['id'], 'nome' => $u['nome'], 'perfil' => $u['perfil']], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?></script>
</head>
<body>
<div class="app" id="app">

  <aside class="sidebar" id="sidebar" aria-label="Menu principal">
    <div class="sb-brand">
      <img class="brand-mark" src="assets/img/reviverfrota-icone-app.svg" alt="" width="40" height="40">
      <div class="sb-name"><b>Reviver <span>Frota</span></b><small>Concessionária Reviver</small></div>
    </div>
    <nav class="sb-nav">
      <span class="sb-label">Operação</span>
      <button class="nav-item" data-go="vistoria"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 4h6v3H9z"/><path d="M7 5H5v16h14V5h-2"/><path d="M8.5 13l2.2 2.2L15.5 10"/></svg>Vistoria</button>
      <?php if ($admin): ?>
      <span class="sb-label">Cadastros</span>
      <button class="nav-item" data-go="modelos"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="2.6" stroke-linecap="round"/></svg>Modelos de checklist</button>
      <button class="nav-item" data-go="frotas"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 15l1.8-5h12.4L19 15v3H3z" transform="translate(1 0)"/><circle cx="7.5" cy="18" r="1.6"/><circle cx="16.5" cy="18" r="1.6"/><path d="M8 10l1-3h6l1 3"/></svg>Frotas e veículos</button>
      <button class="nav-item" data-go="usuarios"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/></svg>Usuários</button>
      <?php endif; ?>
    </nav>
    <div class="sb-foot">
      <button class="nav-item" id="btnTema" type="button"></button>
      <div class="sb-user">
        <span class="avatar" aria-hidden="true"><?= e($iniciais) ?></span>
        <div><b><?= e($u['nome']) ?></b><small><?= $admin ? 'Administrador' : 'Vistoriador' ?></small></div>
        <a class="icon-btn" href="logout.php" aria-label="Sair" title="Sair"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/></svg></a>
      </div>
    </div>
  </aside>
  <div class="sb-scrim" id="sbScrim" hidden></div>

  <div class="main">
    <header class="topbar">
      <div class="tb-in">
        <button class="icon-btn menu-btn" id="btnMenu" aria-label="Abrir menu" aria-controls="sidebar" aria-expanded="false"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
        <div class="tb-title"><nav class="crumbs" id="crumbs" aria-label="Você está em"></nav><h1 id="pageTitle">Vistoria</h1></div>
        <label class="frota-pick"><span>Frota</span><select id="frotaSel" aria-label="Frota"></select></label>
      </div>
    </header>

    <main class="content">
      <section id="v-vistoria" class="view">
        <div class="veh-bar">
          <label class="search"><span class="sr">Buscar veículo</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input type="search" id="vehSearch" placeholder="Buscar placa ou veículo" autocomplete="off"></label>
          <div class="veh-row" id="vehRow"></div>
        </div>
        <div class="insp">
          <div class="stage-wrap">
            <div class="stage" id="stage">
              <canvas id="cv" aria-label="Modelo 3D do veículo. Toque numa peça para registrar avaria."></canvas>
              <div class="hud"><span class="eyebrow" id="hudTipo">Lataria</span></div>
              <div class="viewbar" id="viewBar" role="group" aria-label="Vista do veículo">
                <button data-vista="perspectiva" aria-pressed="true">3D</button>
                <button data-vista="frente" aria-pressed="false">Frente</button>
                <button data-vista="esquerda" aria-pressed="false">Esquerda</button>
                <button data-vista="direita" aria-pressed="false">Direita</button>
                <button data-vista="traseira" aria-pressed="false">Traseira</button>
                <button data-vista="topo" aria-pressed="false">Topo</button>
              </div>
              <svg class="focus-link" id="holoLink" hidden><line id="hlLine"/><circle id="hlDot" r="10"/></svg>
              <div class="focus-card" id="holoCard" hidden>
                <div class="fc-head"><span class="eyebrow" id="hcTag">Avaria</span><button class="icon-btn" id="hcClose" aria-label="Fechar detalhe"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
                <div class="fc-img"><img id="hcImg" alt="Foto da avaria"><div class="fc-noimg" id="hcNo" hidden>Sem foto anexada</div></div>
                <div class="fc-body"><b id="hcParte"></b><div class="fc-meta" id="hcMeta"></div><p id="hcObs"></p></div>
                <div class="fc-foot"><button class="btn sm" id="hcZoom">Ampliar foto</button><label class="btn sm ghost" for="hcFile">Trocar foto</label></div>
                <input type="file" id="hcFile" accept="image/*" class="sr">
              </div>
              <div class="hud-bottom">
                <span class="hint" id="hint">Toque numa peça para registrar avaria. Arraste para girar.</span>
                <span class="legend" aria-label="Gravidade"><span><i style="background:#e0a422"></i>Leve</span><span><i style="background:#e8711a"></i>Média</span><span><i style="background:#d6372e"></i>Grave</span></span>
                <span class="stage-btns">
                  <button class="stage-btn" id="btnVisual" aria-label="Trocar visual 3D do veículo" hidden><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15l1.8-5h12.4L20 15v3H4z"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/></svg>Visual</button>
                  <button class="stage-btn" id="btnReset" aria-label="Recentralizar vista" title="Recentralizar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg></button>
                </span>
              </div>
            </div>
          </div>
          <div class="panel">
            <div class="card summary" id="prog"></div>
            <div class="card tabs-card">
              <div class="seg" role="tablist" id="ptabs">
                <button role="tab" data-pt="ficha">Ficha</button>
                <button role="tab" data-pt="itens">Checklist</button>
                <button role="tab" data-pt="avarias">Avarias</button>
                <button role="tab" data-pt="marcha">Marcha</button>
              </div>
              <div id="pBody"></div>
            </div>
            <div class="actionbar">
              <a class="btn" id="btnFicha" href="#" target="_blank" rel="noopener" aria-disabled="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg><span>Ficha</span></a>
              <button class="btn primary" id="btnConcluir">Concluir vistoria</button>
            </div>
          </div>
        </div>
      </section>
      <section id="v-modelos" class="view" hidden></section>
      <section id="v-frotas" class="view" hidden></section>
      <section id="v-usuarios" class="view" hidden></section>
    </main>
  </div>
</div>

<div class="sheet-bg" id="sheetBg" hidden><div class="sheet" id="sheet" role="dialog" aria-modal="true"></div></div>
<div class="toast" id="toast" role="status" hidden></div>

<!-- three.js r128. Para não depender de internet, baixe o arquivo para assets/vendor/ e troque o src. -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="assets/app.js?v=5"></script>
</body>
</html>
