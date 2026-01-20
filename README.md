# Multicam PTZ Controller

Projeto web para controle de múltiplas câmeras PTZ com persistência local e compatível com o **Custom Browser Dock do OBS**.

## Recursos

- Cadastro de câmeras com driver `MockDriver` ou `GenericHttpDriver`.
- Controles PTZ (pan/tilt/zoom/focus), stop e velocidades configuráveis.
- Cenas por câmera, com criação, edição, aplicação e exclusão.
- Persistência em `data/data.json` no servidor e cache de UX em `localStorage`.
- Backend em Node.js com Express e endpoints REST simples.

## Estrutura

```
/server   -> API + drivers + storage
/client   -> UI (Vite + Bootstrap)
/data     -> data.json (persistência)
```

## Como rodar

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3000

### Produção

```bash
npm run build
npm start
```

O servidor vai servir o conteúdo de `client/dist` em `http://localhost:3000`.

## Como usar no OBS

1. No OBS, abra **View > Docks > Custom Browser Docks**.
2. Adicione um dock apontando para `http://localhost:3000`.
3. Faça o cadastro de câmeras e use o controle PTZ/cenas normalmente.

## Exemplos de templates (GenericHttpDriver)

Os templates aceitam variáveis `{{host}}`, `{{username}}`, `{{password}}`, `{{speed}}`.

```
http://{{host}}/cgi-bin/ptz?move=left&speed={{speed}}
http://{{host}}/cgi-bin/ptz?move=right&speed={{speed}}
http://{{host}}/cgi-bin/ptz?move=up&speed={{speed}}
http://{{host}}/cgi-bin/ptz?move=down&speed={{speed}}
http://{{host}}/cgi-bin/ptz?zoom=tele&speed={{speed}}
http://{{host}}/cgi-bin/ptz?zoom=wide&speed={{speed}}
http://{{host}}/cgi-bin/ptz?focus=near&speed={{speed}}
http://{{host}}/cgi-bin/ptz?focus=far&speed={{speed}}
http://{{host}}/cgi-bin/ptz?move=stop
```

## Fluxo rápido (testar)

1. Selecione **Mock Camera 1**.
2. Use os botões de movimento/zoom/foco.
3. Clique em **Salvar cena atual** e crie cenas como "Pregador" e "Baterista".
4. Aplique as cenas para enviar os comandos configurados.
