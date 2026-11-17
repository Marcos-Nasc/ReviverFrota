<?php
declare(strict_types=1);

// Bootstrap das páginas web: conexão, sessão e funções de login.

require __DIR__ . '/db.php';

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('cfrota_sess');
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
    'secure'   => $https,
]);
session_start();

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

function usuario(): ?array
{
    return $_SESSION['usuario'] ?? null;
}

function eAdmin(): bool
{
    return (usuario()['perfil'] ?? '') === 'admin';
}

function csrf(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrfValido(?string $token): bool
{
    return is_string($token) && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $token);
}

function exigirLoginPagina(): array
{
    $u = usuario();
    if (!$u) {
        header('Location: login.php');
        exit;
    }
    return $u;
}
