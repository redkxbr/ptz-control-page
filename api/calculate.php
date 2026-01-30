<?php
header('Content-Type: application/json; charset=utf-8');

$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput, true);

if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['error' => 'JSON inválido. Envie {"homens":0,"mulheres":0,"criancas":0}.']);
    exit;
}

$homens = isset($payload['homens']) ? (int)$payload['homens'] : 0;
$mulheres = isset($payload['mulheres']) ? (int)$payload['mulheres'] : 0;
$criancas = isset($payload['criancas']) ? (int)$payload['criancas'] : 0;

if ($homens < 0 || $mulheres < 0 || $criancas < 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Os valores não podem ser negativos.']);
    exit;
}

$totalConvidados = $homens + $mulheres + $criancas;
if ($totalConvidados === 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Informe ao menos 1 convidado.']);
    exit;
}

$rulesPath = __DIR__ . '/../config/rules.json';
if (!file_exists($rulesPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Arquivo de regras não encontrado.']);
    exit;
}

$rules = json_decode(file_get_contents($rulesPath), true);
if (!is_array($rules)) {
    http_response_code(500);
    echo json_encode(['error' => 'Arquivo de regras inválido.']);
    exit;
}

function roundToTenth($value)
{
    return ceil($value * 10) / 10;
}

function calcPackages($kg, $weightG)
{
    if ($weightG <= 0) {
        return ['packs' => 0, 'kg' => roundToTenth($kg)];
    }
    $packs = (int)ceil(($kg * 1000) / $weightG);
    $kgFinal = ($packs * $weightG) / 1000;
    return ['packs' => $packs, 'kg' => roundToTenth($kgFinal)];
}

function getSuggestion($catalog, $category)
{
    if (!isset($catalog[$category]) || !is_array($catalog[$category]) || count($catalog[$category]) === 0) {
        return null;
    }
    return $catalog[$category][0];
}

$ea = ($homens * $rules['equivalenteAdulto']['homem']) + ($mulheres * $rules['equivalenteAdulto']['mulher']);
$carneTotalKg = ($ea * $rules['carnePorEA_g']) / 1000;

$carnes = [];
$catalogo = $rules['catalogo'];
foreach ($rules['mixCarnes'] as $categoria => $percentual) {
    $kgCategoria = $carneTotalKg * $percentual;
    $suggestion = getSuggestion($catalogo, $categoria);
    $label = ucfirst($categoria);

    if ($categoria === 'bovino' && (!$suggestion || $suggestion['name'] === 'Opcional (açougue)')) {
        $label = 'Bovino (opcional)';
    }

    $packs = null;
    $kgFinal = roundToTenth($kgCategoria);
    if ($suggestion && isset($suggestion['weight_g']) && ($suggestion['unit'] === 'pacote' || $suggestion['unit'] === 'un')) {
        $calc = calcPackages($kgCategoria, (float)$suggestion['weight_g']);
        $packs = $calc['packs'];
        $kgFinal = $calc['kg'];
    }

    $carnes[] = [
        'category' => $categoria,
        'label' => $label,
        'kg' => $kgFinal,
        'packs' => $packs,
        'productSuggestion' => $suggestion
    ];
}

$kids = [];
$kidsFriatitosKg = $criancas * $rules['kids']['friatitosPorCriancaKg'];
$kidsBatataKg = $criancas * $rules['kids']['batataPorCriancaKg'];

$kidsFriSuggestion = getSuggestion($catalogo, 'kids_friatitos');
$kidsBatSuggestion = getSuggestion($catalogo, 'kids_batata');

$friCalc = $kidsFriSuggestion ? calcPackages($kidsFriatitosKg, (float)$kidsFriSuggestion['weight_g']) : ['packs' => 0, 'kg' => roundToTenth($kidsFriatitosKg)];
$batCalc = $kidsBatSuggestion ? calcPackages($kidsBatataKg, (float)$kidsBatSuggestion['weight_g']) : ['packs' => 0, 'kg' => roundToTenth($kidsBatataKg)];

$kids[] = [
    'label' => 'Friatitos',
    'kg' => $friCalc['kg'],
    'packs' => $friCalc['packs'],
    'productSuggestion' => $kidsFriSuggestion
];
$kids[] = [
    'label' => 'Batata palito',
    'kg' => $batCalc['kg'],
    'packs' => $batCalc['packs'],
    'productSuggestion' => $kidsBatSuggestion
];

$complementos = [];
$cervejaLitros = $ea * $rules['complementos']['cervejaLitrosPorEA'];
$refriLitros = $totalConvidados * $rules['complementos']['refriLitrosPorPessoa'];
$paoUn = (int)ceil($totalConvidados * $rules['complementos']['paoDeAlhoPorPessoa']);
$carvaoKg = roundToTenth($totalConvidados * $rules['complementos']['carvaoKgPorPessoa']);
$geloKg = roundToTenth($totalConvidados * $rules['complementos']['geloKgPorPessoa']);

$complementos[] = ['label' => 'Cerveja', 'value' => roundToTenth($cervejaLitros), 'unit' => 'L'];
$complementos[] = ['label' => 'Refrigerante/Água', 'value' => roundToTenth($refriLitros), 'unit' => 'L'];
$complementos[] = ['label' => 'Pão de alho', 'value' => $paoUn, 'unit' => 'un'];
$complementos[] = ['label' => 'Carvão', 'value' => $carvaoKg, 'unit' => 'kg'];
$complementos[] = ['label' => 'Gelo', 'value' => $geloKg, 'unit' => 'kg'];

$shoppingLines = [];
$shoppingLines[] = 'LISTA DE COMPRAS — CHURRASCO FRIATO';
$shoppingLines[] = 'Convidados: ' . $homens . ' homens, ' . $mulheres . ' mulheres, ' . $criancas . ' crianças';
$shoppingLines[] = '';
$shoppingLines[] = 'ADULTOS (Carnes)';
foreach ($carnes as $carne) {
    $produto = $carne['productSuggestion'] ? $carne['productSuggestion']['name'] : 'Produto sugerido';
    if ($carne['category'] === 'bovino' && (!$carne['productSuggestion'] || $carne['productSuggestion']['name'] === 'Opcional (açougue)')) {
        $shoppingLines[] = '- Bovino (opcional): ' . $carne['kg'] . ' kg';
        continue;
    }
    $packsText = $carne['packs'] !== null ? $carne['packs'] . ' pacotes' : $carne['kg'] . ' kg';
    $shoppingLines[] = '- ' . $carne['label'] . ' (' . $produto . '): ' . $packsText . ' (' . $carne['kg'] . ' kg)';
}
$shoppingLines[] = '';
$shoppingLines[] = 'KIDS (Criançada)';
foreach ($kids as $item) {
    $produto = $item['productSuggestion'] ? $item['productSuggestion']['name'] : 'Produto sugerido';
    $shoppingLines[] = '- ' . $item['label'] . ': ' . $item['packs'] . ' pacotes (' . $item['kg'] . ' kg)';
}
$shoppingLines[] = '';
$shoppingLines[] = 'COMPLEMENTOS';
foreach ($complementos as $comp) {
    $shoppingLines[] = '- ' . $comp['label'] . ': ' . $comp['value'] . ' ' . $comp['unit'];
}
$shoppingLines[] = '';
$shoppingLines[] = 'IMPORTANTE';
$shoppingLines[] = '- Ajuste as gramaturas no arquivo /config/rules.json.';

$shoppingListText = implode("\n", $shoppingLines);

$response = [
    'inputs' => [
        'homens' => $homens,
        'mulheres' => $mulheres,
        'criancas' => $criancas
    ],
    'ea' => roundToTenth($ea),
    'carnes' => $carnes,
    'kids' => $kids,
    'complementos' => $complementos,
    'totals' => [
        'kgAdults' => roundToTenth($carneTotalKg),
        'kgTotal' => roundToTenth($carneTotalKg + $friCalc['kg'] + $batCalc['kg'])
    ],
    'shoppingListText' => $shoppingListText
];

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
