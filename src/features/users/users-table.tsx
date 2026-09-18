import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';
import type { PublicUser } from '@/lib/types';

export function UsersTable({ users, onEdit }: { users: PublicUser[]; onEdit: (user: PublicUser) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="w-28">Role</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-44">Added</TableHead>
            <TableHead className="w-20">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id} className={u.active ? undefined : 'text-muted-foreground'}>
              <TableCell className="font-medium">{u.name}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>{u.role === 'ADMIN' ? <Badge>Admin</Badge> : <Badge variant="outline">Tester</Badge>}</TableCell>
              <TableCell>{u.active ? 'Active' : <Badge variant="secondary">Deactivated</Badge>}</TableCell>
              <TableCell className="text-sm">{formatDateTime(u.createdAt)}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => onEdit(u)}>
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
