import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { badRequest, forbidden, requireAuth, withErrorHandler } from '@/lib/api';
import { HttpStatus } from '@/lib/api/http-status';
import { createComment, listComments } from '@/services/comment.service';

const CommentInputSchema = z.object({
  content: z
    .string()
    .min(1, 'コメント本文は必須です')
    .max(1000, 'コメント本文は1000文字以内で入力してください'),
});

export const GET = withErrorHandler(async (request: NextRequest, context) => {
  const user = await requireAuth(request);
  const { id } = await context!.params;
  const reportId = parseInt(id, 10);
  if (isNaN(reportId)) badRequest('IDは整数で指定してください');

  const result = await listComments(reportId, user.id, user.role, user.departmentId);
  return NextResponse.json(result);
});

export const POST = withErrorHandler(async (request: NextRequest, context) => {
  const user = await requireAuth(request);

  if (user.role !== 'MANAGER') {
    forbidden('コメントを投稿する権限がありません');
  }

  const { id } = await context!.params;
  const reportId = parseInt(id, 10);
  if (isNaN(reportId)) badRequest('IDは整数で指定してください');

  const body = CommentInputSchema.parse(await request.json());
  const result = await createComment(reportId, user.id, body.content);
  return NextResponse.json(result, { status: HttpStatus.CREATED });
});
