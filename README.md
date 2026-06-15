# Página de Obrigado — China Fácil

Página única de confirmação de inscrição (Next.js + App Router). Mostra a mensagem
de agradecimento, faz contagem regressiva de **5 segundos** e redireciona o lead
para o **grupo de WhatsApp**, com botão para entrar manualmente.

## Tracking Meta (alta qualidade)

O evento personalizado (`NEXT_PUBLIC_META_EVENT_NAME`, padrão **`ImportaCF`**)
é disparado de duas formas, com o **mesmo `event_id`** (deduplicação):

1. **Pixel do navegador** — `fbq('trackCustom', '<EVENTO>', ..., { eventID })`
   (eventos personalizados usam `trackCustom`).
2. **Conversions API (server-side)** — `app/api/track/route.ts` envia o mesmo evento
   ao Meta com e-mail/telefone/nome/`external_id` **hasheados em SHA-256**, além de IP,
   user-agent e cookies `_fbp` / `_fbc` (este reconstruído do `fbclid` quando preciso)
   para melhorar o match.

> Dataset configurado: **CTA - PIXEL CHINA FACIL** (`1135630018383985`) — página de
> obrigado do China Fácil (importação). O nome do evento precisa ser **idêntico** aqui
> e na hora de criar a campanha/conversão no Meta.

> Sem o `META_CAPI_TOKEN` configurado, a CAPI é **pulada automaticamente** e só o
> Pixel do navegador funciona — nada quebra.

### Dados do lead vindos do Typeform

Configure o redirect do Typeform para esta página passando os dados na URL, ex.:

```
https://SEU-DOMINIO/?email={{field:email}}&phone={{field:telefone}}&name={{field:nome}}
```

A página lê `email`, `phone` e `name` (também aceita `e`, `p`, `telefone`, `nome`)
e os envia (hasheados no servidor) para a Conversions API.

## Configuração

1. Copie `.env.local.example` para `.env.local` e preencha:
   - `NEXT_PUBLIC_META_PIXEL_ID` — ID do Pixel.
   - `META_CAPI_TOKEN` — token da Conversions API (Gerenciador de Eventos > Pixel >
     Configurações > Conversions API > **Gerar token de acesso**).
   - `NEXT_PUBLIC_WHATSAPP_GROUP_URL` — link do grupo (`https://chat.whatsapp.com/...`).
   - `META_TEST_EVENT_CODE` — (opcional) para validar em "Testar eventos".

2. Instale e rode:

   ```bash
   npm install
   npm run dev      # http://localhost:3000
   ```

3. Produção:

   ```bash
   npm run build && npm run start
   ```

   Ou faça deploy na **Vercel** (defina as mesmas variáveis em Settings > Environment
   Variables — as `NEXT_PUBLIC_*` e o `META_CAPI_TOKEN`).

## Validação do tracking

- **Meta Pixel Helper** (extensão do Chrome) → deve ver `PageView` e `Lead`.
- **Gerenciador de Eventos > Testar eventos** → com `META_TEST_EVENT_CODE` definido,
  o evento server-side aparece marcado como recebido via Conversions API e deduplicado
  com o do navegador.
