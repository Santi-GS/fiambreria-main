import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function getCliArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index !== -1 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }
  return undefined;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function main() {
  const cliEmail = getCliArg('--email');
  const cliPassword = getCliArg('--password');
  const cliName = getCliArg('--name');
  const forceReset = process.argv.includes('--reset-password');
  const isManualCli = Boolean(cliEmail || cliPassword);

  const rawEmail = (cliEmail ?? process.env.INIT_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const rawPassword = cliPassword ?? process.env.INIT_ADMIN_PASSWORD ?? '';
  const rawName = (cliName ?? process.env.INIT_ADMIN_NAME ?? 'Administrador').trim() || 'Administrador';

  if (!rawEmail || !rawPassword) {
    if (isManualCli) {
      console.error(
        '[bootstrap-admin] Uso manual: npm run bootstrap:admin -- --email admin@tudominio.com --password TuPassword123 [--name "Nombre"] [--reset-password]'
      );
      process.exit(1);
    }
    return;
  }

  if (!isValidEmail(rawEmail)) {
    console.error(`[bootstrap-admin] El correo "${rawEmail}" no tiene un formato válido.`);
    if (isManualCli) process.exit(1);
    return;
  }

  if (rawPassword.length < 8 || rawPassword.length > 72) {
    console.error('[bootstrap-admin] La contraseña del administrador debe tener entre 8 y 72 caracteres.');
    if (isManualCli) process.exit(1);
    return;
  }

  if (!isManualCli) {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return;
    }

    const passwordHash = await bcrypt.hash(rawPassword, 12);
    const created = await prisma.user.create({
      data: {
        name: rawName,
        email: rawEmail,
        passwordHash,
        emailVerifiedAt: new Date(),
        forcePasswordReset: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
        defaultShopId: null
      }
    });

    console.log(
      `[bootstrap-admin] Administrador inicial creado exitosamente: ${created.email} (${created.name}). Inicia sesión para configurar el negocio.`
    );
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: rawEmail } });
  const passwordHash = await bcrypt.hash(rawPassword, 12);

  if (existing) {
    if (!forceReset) {
      console.error(
        `[bootstrap-admin] El usuario ${rawEmail} ya existe. Agrega --reset-password si deseas actualizar su contraseña y desbloquear la cuenta.`
      );
      process.exit(1);
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: cliName ? rawName : existing.name,
        passwordHash,
        emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
        forcePasswordReset: false,
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });

    console.log(`[bootstrap-admin] Contraseña actualizada y cuenta habilitada para: ${rawEmail}`);
    return;
  }

  const created = await prisma.user.create({
    data: {
      name: rawName,
      email: rawEmail,
      passwordHash,
      emailVerifiedAt: new Date(),
      forcePasswordReset: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      defaultShopId: null
    }
  });

  console.log(`[bootstrap-admin] Cuenta de administrador creada manualmente: ${created.email}`);
}

main()
  .catch((error) => {
    console.error('[bootstrap-admin] Error al inicializar administrador:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

