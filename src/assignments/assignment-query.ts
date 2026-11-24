import type { Prisma } from '../generated/prisma/client.js';
import type { ListQueryDto } from '../common/list-query.dto.js';
export function assignmentWhere(
  scope: Prisma.AssignmentWhereInput,
  query: ListQueryDto,
  studentId?: string,
): Prisma.AssignmentWhereInput {
  const and: Prisma.AssignmentWhereInput[] = [scope];
  if (query.group && query.group !== 'all') and.push({ groupId: query.group });
  if (query.period && query.period !== 'all')
    and.push({ group: { academicPeriod: { name: query.period } } });
  const contains = {
    contains: query.q?.trim() ?? '',
    mode: 'insensitive' as const,
  };
  if (query.q?.trim())
    and.push({
      OR: [
        { tittle: contains },
        { instructions: contains },
        { group: { name: contains } },
        { group: { subject: { name: contains } } },
      ],
    });
  if (studentId && query.status && query.status !== 'all') {
    if (query.status === 'graded' || query.status === 'submitted')
      and.push({
        submissions: {
          some: {
            studentId,
            grade: query.status === 'graded' ? { not: null } : null,
          },
        },
      });
    else if (query.status === 'pending' || query.status === 'overdue')
      and.push({
        submissions: { none: { studentId } },
        dueDate:
          query.status === 'pending' ? { gte: new Date() } : { lt: new Date() },
      });
  }
  return { AND: and };
}
export function assignmentOrder(
  query: ListQueryDto,
): Prisma.AssignmentOrderByWithRelationInput[] {
  return [
    query.order === 'title'
      ? { tittle: 'asc' }
      : { dueDate: query.order === 'dueDesc' ? 'desc' : 'asc' },
    { id: 'asc' },
  ];
}
