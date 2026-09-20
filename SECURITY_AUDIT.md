# DECIDE AÍ — AUDITORIA DE SEGURANÇA FIRESTORE (v1.1)

Esta auditoria valida as regras do Cloud Firestore e a camada de serviços do **DECIDE AÍ** contra o vetor de ataques "Dirty Dozen" (Red Team Audit), garantindo o princípio de autoridade do servidor e permissão mínima (Default Deny).

---

## 1. Matriz de Vetores de Ataque (Dirty Dozen)

| Código | Vetor de Ataque Testado | Regra Enforçada | Resultado Esperado | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TEST-A** | Cliente anônimo não autenticado tenta criar sala | `isSignedIn()` | `PERMISSION_DENIED` | ✅ Bloqueado |
| **TEST-B** | Cliente tenta criar sala definindo `hostId` de terceiros | `request.resource.data.hostId == request.auth.uid` | `PERMISSION_DENIED` | ✅ Bloqueado |
| **TEST-C** | Cliente tenta modificar `publicCode`, `hostId` ou `question` | `request.resource.data.hostId == resource.data.hostId` | `PERMISSION_DENIED` | ✅ Bloqueado |
| **TEST-D** | Participante B tenta votar enviando `participantId` de A | `request.auth.uid == participantId` | `PERMISSION_DENIED` | ✅ Bloqueado |
| **TEST-E** | Participante tenta votar duas vezes na mesma sala | `!exists(votes/$(participantId))` + Transação Atômica | `ALREADY_EXISTS / PERMISSION_DENIED` | ✅ Bloqueado |
| **TEST-F** | Participante comum tenta forçar encerramento (`finishVoting`) | `resource.data.hostId == request.auth.uid` | `PERMISSION_DENIED` | ✅ Bloqueado |
| **TEST-G** | Participante comum tenta definir vencedor ou desempate | `resource.data.hostId == request.auth.uid` | `PERMISSION_DENIED` | ✅ Bloqueado |
| **TEST-H** | Usuário tenta alterar opções ou pergunta com votação aberta | `affectedKeys().hasOnly(['status', ...])` | `PERMISSION_DENIED` | ✅ Bloqueado |
| **TEST-I** | Usuário tenta atualizar (`update`) documento de voto já gravado | `allow update: if false;` | `PERMISSION_DENIED` | ✅ Bloqueado |
| **TEST-J** | Usuário tenta excluir (`delete`) documento de voto da subcoleção | `allow delete: if false;` | `PERMISSION_DENIED` | ✅ Bloqueado |
| **TEST-K** | Participante tenta injetar `isHost: true` no seu registro | `request.resource.data.isHost != true \|\| getRoom().hostId == request.auth.uid` | `PERMISSION_DENIED` | ✅ Bloqueado |
| **TEST-L** | Participante comum tenta excluir (`delete`) o documento da sala | `resource.data.hostId == request.auth.uid` | `PERMISSION_DENIED` | ✅ Bloqueado |

---

## 2. Implementação Técnica

### A. Autenticação Anônima Invisível (`ensureAnonymousAuth`)
* Não exige cadastro, e-mail, senha nem ação manual do usuário.
* O Firebase Auth emite um `uid` único por dispositivo/sessão.
* Este `uid` é a identidade criptográfica utilizada por `request.auth.uid`.

### B. Transação Atômica de Voto (`submitVote`)
* Executada através de `runTransaction()`.
* Garante simultaneamente:
  1. Criação do documento único em `rooms/{roomId}/votes/{uid}`.
  2. Atualização dos atributos `chosenOptionId` e `votedAt` em `participants/{uid}`.
  3. Incremento atômico dos contadores de votos em `rooms/{roomId}`.

### C. Desempate Protegido (`resolveTieInFirestore`)
* Apenas o anfitrião autenticado (`hostId == request.auth.uid`) possui autorização nas regras de segurança para transicionar o status de `tie` para `finished`.
* Os demais participantes conectados visualizam a tela de espera e recebem o resultado instantaneamente em tempo real via `subscribeToRoom()`.
