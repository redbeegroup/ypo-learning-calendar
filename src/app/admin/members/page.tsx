import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { listUsers } from "@/server/services/users";
import { listChapters, queryFromSearchParams } from "@/server/services/events";
import { userListQuerySchema } from "@/lib/validation/users";
import { MembersTable } from "@/components/admin/members-table";
import { MembersFilters } from "@/components/admin/members-filters";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function MembersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const query = userListQuerySchema.parse(queryFromSearchParams(await searchParams));
  const [result, chapters] = await Promise.all([listUsers(user, query), listChapters()]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="text-sm text-muted-foreground">
          {result.total} member{result.total === 1 ? "" : "s"}
          {user.role === "CHAPTER_ADMIN" && ` in ${user.chapterName}`}
        </p>
      </div>
      <MembersFilters chapters={chapters} showChapter={user.role === "SUPER_ADMIN"} />
      <MembersTable
        users={result.items}
        chapters={chapters}
        actor={{ id: user.id, role: user.role, chapterId: user.chapterId }}
      />
    </div>
  );
}
