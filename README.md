# Calculadora de Churrasco Friato

Aplicação web completa (HTML + CSS + JS + PHP) pronta para embed via iframe, com layout em cards e identidade visual inspirada na paleta Friato.

## Estrutura

```
/public
  index.html
  styles.css
  app.js
/api
  calculate.php
/config
  rules.json
/README.md
```

## Como rodar localmente

> Requer PHP 7.4+.

```bash
php -S localhost:8000 -t public
```

Acesse: http://localhost:8000

## Exemplo de iframe

```html
<iframe src="https://meudominio.com/churrasco/public/?theme=light" style="width:100%;height:900px;border:0;"></iframe>
```

## Parâmetros de URL

- `?theme=light|dark`
- `?primaryColor=%23xxxxxx` (override do vermelho)
- `?secondaryColor=%23xxxxxx` (override do verde/azulado)

## Como editar regras e catálogo

Abra `/config/rules.json` para ajustar:

- `equivalenteAdulto`: peso de equivalência por perfil.
- `carnePorEA_g`: gramatura por equivalente adulto.
- `mixCarnes`: percentual de cada categoria.
- `kids`: gramaturas por criança.
- `complementos`: litros/kg/unidades por pessoa.
- `catalogo`: produtos sugeridos e gramaturas em gramas.

> Dica: ajuste `weight_g` para refletir o pacote real da sua loja.

## Lista de compras

A lista é gerada automaticamente pelo backend (`/api/calculate.php`) e exibida na tela de resultado para copiar, baixar .txt ou imprimir.
