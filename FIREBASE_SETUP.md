# DECIDE AÍ — Documentação da Integração com Firebase & Firestore

Esta documentação descreve a arquitetura multiplayer implementada para o **DECIDE AÍ**, permitindo que múltiplos usuários em dispositivos e navegadores diferentes criem salas de decisão, compartilhem links, votem e acompanhem resultados em tempo real.

---

## 1. Visão Geral da Arquitetura

O sistema opera com separação estrita de responsabilidades:

1. **Sorteios Rápidos Individuais (Raffle)**:
   - Permanecem locais no navegador (`localStorage`), sem custo de banco e com resposta instantânea de animação e confetes.
2. **Decisões em Grupo (Multiplayer Rooms)**:
   - Migradas integralmente para o **Google Cloud Firestore**.
   - Sincronização em tempo real via listeners reativos (`onSnapshot`), eliminando necessidade de polling ou recarregamento manual.
   - Cada sala possui um código curto de 4 caracteres (ex: `8F72`) para URLs amigáveis (`/group/8F72` ou `?room=8F72`).

---

## 2. Variáveis de Ambiente Necessárias

Para ativar a sincronização com o Firestore, configure as seguintes variáveis no arquivo `.env.local`:

```env
VITE_FIREBASE_API_KEY=sua_api_key_aqui
VITE_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu_projeto_id
VITE_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
VITE_FIREBASE_APP_ID=seu_app_id
```

> **Nota:** Caso as variáveis não estejam configuradas em um ambiente de desenvolvimento inicial, o aplicativo opera com fallback local seguro sem travar a interface.

---

## 3. Estrutura de Coleções e Subcoleções no Firestore

### 3.1 Coleção Principal: `rooms/{roomId}`
Documento representativo da sala.
- `id`: ID único interno do documento Firestore.
- `publicCode`: Código público de 4 caracteres maiúsculos (ex: `8F72`).
- `question`: Pergunta a ser decidida.
- `options`: Array com `{ id, text, emoji, votes }`.
- `status`: `'waiting' | 'voting' | 'finished' | 'tie' | 'closed'`.
- `hostId`: ID do criador da sala.
- `hostName`: Nome do criador.
- `maxParticipants`: Limite de votos ou `null` (sem limite).
- `isSecretVoting`: Booleano para ocultar contagem até a revelação.
- `winnerOptionId`: ID da opção vencedora após o encerramento.
- `tiedOptionIds`: Array de IDs empatados (caso status seja `'tie'`).
- `isTieBreaker`: Booleano que indica se o resultado final veio de um desempate.
- `createdAt`, `updatedAt`, `finishedAt`: Timestamps ISO 8601.

### 3.2 Subcoleção: `rooms/{roomId}/participants/{participantId}`
Lista de pessoas conectadas à sala.
- `id`: ID único do participante (persistido no `localStorage` do dispositivo).
- `name`: Nome ou apelido informado.
- `joinedAt`: Data e hora de entrada.
- `isHost`: `true` se for o anfitrião.
- `chosenOptionId`: Opção em que votou (se já tiver votado).
- `votedAt`: Timestamp do voto.

### 3.3 Subcoleção: `rooms/{roomId}/votes/{participantId}`
Subcoleção imutável para contagem confiável e proteção contra votos duplicados.
- ID do documento é o próprio `participantId`.
- Garante atomicidade: um participante não consegue enviar dois votos na mesma sala.
- `optionId`: Opção escolhida.
- `participantName`: Nome do votante.
- `createdAt`: Timestamp do voto.

---

## 4. Regras de Segurança (`firestore.rules`)

As regras de segurança estão definidas no arquivo `firestore.rules` seguindo o padrão de **Default Deny** e controle rigoroso:

- **Leitura pública** de salas para permitir entrada via link/código.
- **Criação de sala** validando número mínimo de 2 e máximo de 12 opções, campos obrigatórios e status válidos.
- **Atualização da sala** restrita aos parâmetros autorizados e ações de encerramento/desempate pelo host.
- **Voto único e imutável**: O documento em `votes/{participantId}` só pode ser criado se ainda não existir (`!exists(...)`) e tem updates desabilitados (`allow update: if false;`).

Para implantar as regras de segurança no seu projeto Firebase:
```bash
firebase deploy --only firestore:rules
```

---

## 5. Como Testar em Dois Navegadores ou Dispositivos

1. **No Navegador 1 (Anfitrião / Dispositivo A)**:
   - Clique em **"Criar em Grupo"** na tela inicial.
   - Preencha a pergunta e as opções (ex: "Onde vamos almoçar?", opções: Pizza, Hambúrguer, Sushi).
   - Clique em **"DECIDE AÍ"**. A sala é criada e um código de 4 caracteres é gerado (ex: `8F72`).
   - Clique em **"Copiar Link"** ou compartilhe a URL: `https://.../group/8F72`.

2. **No Navegador 2 (Amigo / Aba Anônima / Dispositivo B)**:
   - Abra o link copiado ou acesse a página inicial e clique em **"Entrar com Código"**, digitando `8F72`.
   - Digite seu nome (ex: "Lucas").
   - Selecione sua opção de voto e clique em **"CONFIRMAR VOTO"**.
   - O voto é registrado instantaneamente.

3. **Verificação em Tempo Real**:
   - O Dispositivo A exibe imediatamente o contador de participantes e votos atualizados, sem necessidade de atualizar a página.
   - O anfitrião clica em **"Encerrar votação e ver resultado agora"**.
   - Ambos os dispositivos recebem o encerramento em tempo real.
   - Em caso de empate, o anfitrião clica em **"DESEMPATAR"** e todos os dispositivos acompanham a animação e o vencedor final sincronizado!

---

## 6. O que Permaneceu Local e Por Quê

1. **Sorteios Rápidos Individuais (`raffle`)**:
   - Permanecem armazenados exclusivamente no `localStorage`.
   - Justificativa: Sorteios individuais de "cara ou coroa" ou decisões instantâneas não necessitam de colaboração de rede, mantendo o app ultrarrápido, sem latência e com privacidade total.
2. **Identidade do Participante da Sala**:
   - O identificador do participante para cada sala (`decide_ai_room_participant_{roomId}`) é salvo no `localStorage` do navegador para manter a sessão ativa em caso de recarregamento acidental de página.
