import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { canManageChapters } from "@/server/permissions";
import { listAllChapters } from "@/server/services/catalog";
import { CatalogTable, type CatalogRow } from "@/components/admin/catalog-table";

export default async function ChaptersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageChapters(user)) redirect("/admin/events");
  const chapters = await listAllChapters(user);
  const rows: CatalogRow[] = chapters.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    country: c.country,
    isActive: c.isActive,
    usage: `${c._count.users} members · ${c._count.hostedEvents} events`,
  }));
  return (
    <CatalogTable
      title="Chapters"
      singular="chapter"
      endpoint="/chapters"
      rows={rows}
      fields={[
        { name: "name", label: "Name", placeholder: "Singapore Gold" },
        { name: "code", label: "Code", placeholder: "SGG" },
        { name: "country", label: "Country", placeholder: "Singapore" },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "code", label: "Code" },
        { key: "country", label: "Country" },
      ]}
    />
  );
}
