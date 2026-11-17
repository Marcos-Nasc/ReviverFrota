<?php
declare(strict_types=1);

require __DIR__ . '/../src/bootstrap.php';

if (usuario()) {
    header('Location: index.php');
    exit;
}

$erro = '';
$login = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $login = trim((string)($_POST['login'] ?? ''));
    $senha = (string)($_POST['senha'] ?? '');
    $_SESSION['tentativas'] = ($_SESSION['tentativas'] ?? 0);
    // passado o minuto de espera, zera o contador
    if (time() - ($_SESSION['ultima_tentativa'] ?? 0) >= 60) {
        $_SESSION['tentativas'] = 0;
    }

    if (!csrfValido($_POST['csrf'] ?? null)) {
        $erro = 'A página expirou. Tente entrar de novo.';
    } elseif ($_SESSION['tentativas'] >= 5 && time() - ($_SESSION['ultima_tentativa'] ?? 0) < 60) {
        $erro = 'Muitas tentativas. Aguarde um minuto e tente de novo.';
    } else {
        $st = db()->prepare('SELECT id, nome, login, senha_hash, perfil FROM usuarios WHERE login = ? AND ativo = 1');
        $st->execute([$login]);
        $u = $st->fetch();
        if ($u && password_verify($senha, $u['senha_hash']) && $u['perfil'] === 'motorista') {
            $erro = 'Usuários de motorista não entram no sistema: eles só assinam a vistoria no aparelho do vistoriador.';
        } elseif ($u && password_verify($senha, $u['senha_hash'])) {
            session_regenerate_id(true);
            unset($_SESSION['tentativas'], $_SESSION['ultima_tentativa']);
            $_SESSION['usuario'] = ['id' => (int)$u['id'], 'nome' => $u['nome'], 'login' => $u['login'], 'perfil' => $u['perfil']];
            if (password_needs_rehash($u['senha_hash'], PASSWORD_DEFAULT)) {
                db()->prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?')->execute([password_hash($senha, PASSWORD_DEFAULT), $u['id']]);
            }
            db()->prepare('UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = ?')->execute([$u['id']]);
            header('Location: index.php');
            exit;
        }
        if ($erro === '') {
            $_SESSION['tentativas']++;
            $_SESSION['ultima_tentativa'] = time();
            usleep(400000);
            $erro = 'Usuário ou senha incorretos.';
        }
    }
}
?><!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Entrar · ReviverFrota</title>
<link rel="icon" href="assets/img/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="assets/img/favicon-32.png">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
<meta name="theme-color" content="#023d75">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<script>try{document.documentElement.setAttribute('data-theme',localStorage.getItem('reviver-checklist-tema')||'light')}catch(e){document.documentElement.setAttribute('data-theme','light')}</script>
<link rel="stylesheet" href="assets/app.css?v=4">
</head>
<body class="login-page">
  <aside class="login-side">
    <img class="login-logo" src="assets/img/reviverfrota-logo-negativo.png" alt="ReviverFrota · Concessionária Reviver" height="64">
    <div>
      <h2>Controle de qualidade da frota</h2>
      <p>Vistorias de saída e de qualidade em um só lugar, com a ficha de cada tipo de veículo e o registro das avarias na peça certa.</p>
      <ul>
        <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l4 4 10-10"/></svg>Checklist por modelo e personalizado por frota</li>
        <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l4 4 10-10"/></svg>Avarias marcadas no veículo 3D, com foto</li>
        <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l4 4 10-10"/></svg>Assinaturas e ficha pronta para impressão</li>
      </ul>
    </div>
    <small>Concessionária Reviver · Inovação</small>
  </aside>
  <main class="login-main">
    <div class="login-box">
      <div class="login-brand">
        <img class="logo-claro" src="assets/img/reviverfrota-logo.png" alt="ReviverFrota · Concessionária Reviver" height="52">
        <img class="logo-escuro" src="assets/img/reviverfrota-logo-negativo.png" alt="ReviverFrota · Concessionária Reviver" height="52">
      </div>
      <form method="post" class="login-form" autocomplete="on">
        <h1>Entrar no sistema</h1>
        <p>Use o usuário e a senha fornecidos pelo administrador.</p>
        <?php if ($erro): ?><div class="alert" role="alert"><?= e($erro) ?></div><?php endif; ?>
        <input type="hidden" name="csrf" value="<?= e(csrf()) ?>">
        <label class="fld"><span>Usuário</span><input type="text" name="login" id="login" value="<?= e($login) ?>" autocomplete="username" required autofocus></label>
        <label class="fld"><span>Senha</span><input type="password" name="senha" id="senha" autocomplete="current-password" required></label>
        <button class="btn primary block" type="submit">Entrar</button>
      </form>
    </div>
  </main>
</body>
</html>
