import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AccountSettings from "@/components/settings/AccountSettings";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/settings");

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true, passwordHash: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <AccountSettings
        email={user.email}
        phone={user.phone}
        hasPassword={Boolean(user.passwordHash)}
      />
    </div>
  );
}
