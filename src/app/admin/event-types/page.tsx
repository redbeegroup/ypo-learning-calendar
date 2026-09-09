import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { canManageChapters } from "@/server/permissions";
import { listAllEventTypes } from "@/server/services/catalog";
import { CatalogTable, type CatalogRow } from "@/components/admin/catalog-table";

export default async function EventTypesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageChapters(user)) redirect("/admin/events");
  const types = await listAllEventTypes(user);
  const rows: CatalogRow[] = types.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    sortOrder: t.sortOrder,
    isActive: t.isActive,
    usage: `${t._count.events} events`,
  }));
  return (
    <CatalogTable
      title="Event types"
      singular="event type"
      endpoint="/event-types"
      rows={rows}
      fields={[
        { name: "name", label: "Name", placeholder: "Leadership" },
        { name: "color", label: "Colour", type: "color", placeholder: "#2563eb" },
        { name: "sortOrder", label: "Sort order", type: "number" },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "color", label: "Colour", kind: "color" },
        { key: "sortOrder", label: "Order" },
      ]}
    />
  );
}
