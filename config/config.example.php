<?php
// Copie este arquivo para config/config.php e ajuste os valores.
// O config.php NÃO deve ir para o Git.
return [
    'db' => [
        'host' => '127.0.0.1',
        'port' => 3306,
        'name' => 'checklist_frota',
        'user' => 'checklist',
        'pass' => 'troque-esta-senha',
    ],

    // Pasta onde ficam fotos das avarias e assinaturas.
    // Deve ficar FORA da pasta pública (public/) e o PHP precisa ter permissão de escrita.
    'uploads' => __DIR__ . '/../storage/uploads',

    // Tamanho máximo de cada foto enviada, em MB.
    'foto_max_mb' => 8,

    'timezone' => 'America/Sao_Paulo',

    // true só em desenvolvimento: mostra detalhes de erro.
    'debug' => false,
];
