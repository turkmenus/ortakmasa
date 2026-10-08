import { database } from '@colanode/server/data/database';
import { generateApiTokenId, generatePatToken } from '@colanode/server/lib/tokens';

const run = async () => {
  const args = process.argv.slice(2);
  const email = args[0];
  const tokenName = args[1] || 'MCP Agent Token';

  if (!email) {
    console.error('Kullanım: npx tsx src/scripts/create-pat.ts <kullanıcı_email> [token_adı]');
    console.error('Örnek:   npx tsx src/scripts/create-pat.ts ushakov@halkynsesi.media "Claude MCP"');
    process.exit(1);
  }

  const account = await database
    .selectFrom('accounts')
    .selectAll()
    .where('email', '=', email.toLowerCase().trim())
    .executeTakeFirst();

  if (!account) {
    console.error(`Hata: '${email}' e-posta adresine sahip hesap bulunamadı!`);
    process.exit(1);
  }

  const user = await database
    .selectFrom('users')
    .selectAll()
    .where('account_id', '=', account.id)
    .executeTakeFirst();

  const tokenId = generateApiTokenId();
  const generated = generatePatToken(tokenId);

  await database
    .insertInto('api_tokens')
    .values({
      id: generated.id,
      account_id: account.id,
      workspace_id: user?.workspace_id ?? null,
      user_id: user?.id ?? null,
      name: tokenName,
      token_hash: generated.hash,
      token_salt: generated.salt,
      scopes: JSON.stringify(['read', 'write']) as never,
      status: 1,
      created_at: new Date(),
    })
    .execute();

  console.log('\n======================================================');
  console.log('✅ Ortakmasa PAT (Personal Access Token) Oluşturuldu!');
  console.log('======================================================');
  console.log(`Hesap E-posta : ${account.email}`);
  console.log(`Token Adı     : ${tokenName}`);
  console.log(`Token ID      : ${generated.id}`);
  console.log(`Token         : ${generated.token}`);
  console.log('======================================================');
  console.log('\n📡 MCP SSE Bağlantı Adresi:');
  console.log(`URL: https://oratakmasa.testedeli.online/mcp`);
  console.log(`veya: https://oratakmasa.testedeli.online/mcp?token=${generated.token}`);
  console.log('\n🤖 Claude Desktop / Cursor Konfigürasyonu:');
  console.log(
    JSON.stringify(
      {
        mcpServers: {
          ortakmasa: {
            url: 'https://oratakmasa.testedeli.online/mcp',
            headers: {
              Authorization: `Bearer ${generated.token}`,
            },
          },
        },
      },
      null,
      2
    )
  );
  console.log('======================================================\n');

  process.exit(0);
};

run().catch((err) => {
  console.error('Beklenmeyen hata:', err);
  process.exit(1);
});
