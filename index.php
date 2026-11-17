<?php
// Entrada pela raiz do projeto (ex.: http://localhost/checklist-frota/).
// A aplicação fica em public/. Em produção, o ideal é o DocumentRoot apontar direto para public/.
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
header('Location: ' . $base . '/public/', true, 302);
exit;
