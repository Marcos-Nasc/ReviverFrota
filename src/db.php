<?php
declare(strict_types=1);

// Carrega configuração e conexão. Usado pela web e pelos scripts de linha de comando.

$cfgFile = __DIR__ . '/../config/config.php';
if (!is_file($cfgFile)) {
    http_response_code(500);
    exit("Falta o arquivo config/config.php. Copie config/config.example.php e ajuste os dados do banco.\n");
}
$GLOBALS['CONFIG'] = require $cfgFile;
date_default_timezone_set(cfg('timezone') ?? 'America/Sao_Paulo');
ini_set('display_errors', cfg('debug') ? '1' : '0');
error_reporting(E_ALL);

function cfg(string $chave): mixed
{
    return $GLOBALS['CONFIG'][$chave] ?? null;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $d = cfg('db');
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $d['host'], (int)($d['port'] ?? 3306), $d['name']);
        $pdo = new PDO($dsn, $d['user'], $d['pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        $pdo->exec("SET time_zone = '" . (new DateTime())->format('P') . "'");
    }
    return $pdo;
}

function e(mixed $s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}
