import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Issue = { id: number; file: string; record_id: string; issue: string; resolution: string };

export default async function DataIssuesPage() {
  const issues = [...(await db()`select id, file, record_id, issue, resolution from import_issues order by id`)] as unknown as Issue[];
  return (
    <>
      <h1>Data issues</h1>
      <p className="sub">Everything the import step (<code>scripts/clean.mjs</code>) found and how it was handled. Re-running the import (<code>npm run seed</code>, or any deploy) refreshes this list; notes, next steps and tasks created in the app are never touched.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>File</th><th>Record</th><th>Issue</th><th>How it was handled</th></tr></thead>
          <tbody>
            {issues.map((i) => (
              <tr key={i.id}>
                <td className="nowrap small">{i.file}</td>
                <td className="small" style={{ maxWidth: 160 }}>{i.record_id}</td>
                <td>{i.issue}</td>
                <td className="muted">{i.resolution}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
