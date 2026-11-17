<?php
declare(strict_types=1);

// Cria ou atualiza um usuário pela linha de comando.
// Uso:
//   php bin/criar_usuario.php --login=marcos --nome="Marcos Nascimento" --perfil=admin
//   (a senha é pedida no terminal; ou use --senha=... em scripts)
// Perfis: admin (cadastros e usuários) | vistoriador (faz vistorias) | motorista (só assina vistorias)
// Opcional: --matricula=12345

if (PHP_SAPI !== 'cli') {
    exit("Rode este script pelo terminal.\n");
}
require __DIR__ . '/../src/db.php';
ini_set('display_errors', '1');
set_exception_handler(function (Throwable $e) {
    fwrite(STDERR, "ERRO: " . $e->getMessage() . "\n");
    exit(1);
});
echo "Conectando no banco '" . (cfg('db')['name'] ?? '?') . "' como '" . (cfg('db')['user'] ?? '?') . "'...\n";
db();
echo "Conectado.\n";

$o = getopt('', ['login:', 'nome:', 'perfil::', 'senha::', 'matricula::', 'desativar']);
if (empty($o['login'])) {
    exit("Uso: php bin/criar_usuario.php --login=usuario --nome=\"Nome\" [--perfil=admin|vistoriador|motorista] [--matricula=...] [--senha=...] [--desativar]\n");
}
$login = trim($o['login']);

if (isset($o['desativar'])) {
    $n = db()->prepare('UPDATE usuarios SET ativo = 0 WHERE login = ?');
    $n->execute([$login]);
    exit($n->rowCount() ? "Usuário $login desativado.\n" : "Usuário $login não encontrado.\n");
}

$perfil = in_array($o['perfil'] ?? '', ['admin', 'vistoriador', 'motorista'], true) ? $o['perfil'] : 'vistoriador';
$matricula = trim($o['matricula'] ?? '');
$nome = trim($o['nome'] ?? $login);
$senha = $o['senha'] ?? null;
if ($senha === null) {
    echo 'Senha (mínimo 6 caracteres): ';
    if (DIRECTORY_SEPARATOR === '/') {
        system('stty -echo');
    }
    $senha = trim((string)fgets(STDIN));
    if (DIRECTORY_SEPARATOR === '/') {
        system('stty echo');
    }
    echo "\n";
}
if (mb_strlen($senha) < 6) {
    exit("A senha precisa ter pelo menos 6 caracteres.\n");
}

$hash = password_hash($senha, PASSWORD_DEFAULT);
db()->prepare(
    'INSERT INTO usuarios (nome, login, matricula, senha_hash, perfil) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE nome = VALUES(nome), matricula = VALUES(matricula), senha_hash = VALUES(senha_hash), perfil = VALUES(perfil), ativo = 1'
)->execute([$nome, $login, $matricula, $hash, $perfil]);

echo "Usuário $login salvo com perfil $perfil.\n";
