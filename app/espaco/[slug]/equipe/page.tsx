import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgAccess, canManageTeamSession } from "@/lib/auth";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  PROFILES,
} from "@/lib/endurance/permissions";
import EquipeClient, { type MemberView, type ActivityView } from "./equipe-client";

export default async function EquipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireOrgAccess(slug);
  if (!canManageTeamSession(session)) redirect(`/espaco/${slug}`);

  const [users, logs] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: session.org },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        jobTitle: true,
        role: true,
        profile: true,
        permissions: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
    prisma.activityLog.findMany({
      where: { organizationId: session.org },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        actorName: true,
        action: true,
        detail: true,
        createdAt: true,
      },
    }),
  ]);

  const members: MemberView[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    jobTitle: u.jobTitle,
    role: u.role,
    profile: u.profile,
    permissions: u.permissions,
    status: u.status,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  }));

  const activity: ActivityView[] = logs.map((l) => ({
    id: l.id,
    actorName: l.actorName,
    action: l.action,
    detail: l.detail,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <EquipeClient
      slug={slug}
      currentUserId={session.sub}
      members={members}
      activity={activity}
      permissions={PERMISSIONS}
      permissionGroups={PERMISSION_GROUPS}
      profiles={PROFILES}
    />
  );
}
